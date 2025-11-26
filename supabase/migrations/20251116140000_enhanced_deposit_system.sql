-- Enhanced Deposit Management System
-- This migration adds better deposit tracking, automated status updates, and deposit lifecycle management

-- Add deposit status tracking to rental_requests
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS deposit_status text DEFAULT 'not_required' 
  CHECK (deposit_status IN ('not_required', 'pending', 'held', 'released', 'partially_charged', 'fully_charged'));

-- Add deposit release/charge timestamps
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS deposit_held_at timestamptz;
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS deposit_released_at timestamptz;
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS deposit_charged_amount numeric DEFAULT 0 CHECK (deposit_charged_amount >= 0);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_rental_requests_deposit_status ON rental_requests(deposit_status);
CREATE INDEX IF NOT EXISTS idx_rental_requests_status_created ON rental_requests(status, created_at);

-- Create deposit_transactions table for detailed tracking
CREATE TABLE IF NOT EXISTS deposit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_request_id uuid REFERENCES rental_requests(id) ON DELETE CASCADE NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('hold', 'release', 'partial_charge', 'full_charge')),
  amount numeric NOT NULL CHECK (amount >= 0),
  reason text, -- For charges: "Damage to lens", "Late return fee", etc.
  notes text,
  processed_by uuid REFERENCES profiles(id), -- Who processed this transaction
  created_at timestamptz DEFAULT now()
);

-- Add RLS policies for deposit_transactions
ALTER TABLE deposit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view deposit transactions for their rentals"
  ON deposit_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rental_requests
      WHERE rental_requests.id = deposit_transactions.rental_request_id
      AND (rental_requests.renter_id = auth.uid() OR rental_requests.gear_owner_id = auth.uid())
    )
  );

CREATE POLICY "Gear owners can create deposit transactions"
  ON deposit_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rental_requests
      WHERE rental_requests.id = deposit_transactions.rental_request_id
      AND rental_requests.gear_owner_id = auth.uid()
    )
  );

-- Indexes for deposit_transactions
CREATE INDEX IF NOT EXISTS idx_deposit_transactions_rental ON deposit_transactions(rental_request_id);
CREATE INDEX IF NOT EXISTS idx_deposit_transactions_type ON deposit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_deposit_transactions_created ON deposit_transactions(created_at);

-- Function to automatically update deposit status when rental status changes
CREATE OR REPLACE FUNCTION update_deposit_status_on_rental_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When rental becomes active and there's a deposit, mark it as held
  IF NEW.status = 'active' AND OLD.status = 'pending' AND NEW.gear_deposit_amount > 0 THEN
    NEW.deposit_status := 'held';
    NEW.deposit_held_at := now();
    
    -- Create a deposit transaction record
    INSERT INTO deposit_transactions (rental_request_id, transaction_type, amount, notes)
    VALUES (NEW.id, 'hold', NEW.gear_deposit_amount, 'Security deposit held at rental start');
  END IF;
  
  -- When rental is completed and no damage reported, mark deposit for release
  IF NEW.status = 'completed' AND OLD.status = 'active' THEN
    IF NEW.deposit_status = 'held' THEN
      -- Check if there's damage reported
      IF NEW.damage_flag = true OR NEW.condition_status = 'damaged' THEN
        -- Leave as 'held' for owner to decide on charges
        NEW.deposit_status := 'held';
      ELSE
        -- Auto-release if no damage
        NEW.deposit_status := 'released';
        NEW.deposit_released_at := now();
        
        -- Create release transaction
        INSERT INTO deposit_transactions (rental_request_id, transaction_type, amount, notes)
        VALUES (NEW.id, 'release', NEW.gear_deposit_amount, 'Security deposit released - no damage reported');
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for deposit status updates
DROP TRIGGER IF EXISTS trigger_update_deposit_status ON rental_requests;
CREATE TRIGGER trigger_update_deposit_status
  BEFORE UPDATE ON rental_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_deposit_status_on_rental_change();

-- Function for gear owners to charge deposit (partial or full)
CREATE OR REPLACE FUNCTION charge_deposit(
  p_rental_request_id uuid,
  p_amount numeric,
  p_reason text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_rental rental_requests%ROWTYPE;
  v_remaining numeric;
  v_transaction_type text;
BEGIN
  -- Get rental details
  SELECT * INTO v_rental FROM rental_requests WHERE id = p_rental_request_id;
  
  -- Verify caller is the gear owner
  IF v_rental.gear_owner_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the gear owner can charge deposits');
  END IF;
  
  -- Verify deposit is held
  IF v_rental.deposit_status NOT IN ('held', 'partially_charged') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit is not available to charge');
  END IF;
  
  -- Calculate remaining deposit
  v_remaining := v_rental.gear_deposit_amount - v_rental.deposit_charged_amount;
  
  -- Verify amount doesn't exceed remaining deposit
  IF p_amount > v_remaining THEN
    RETURN jsonb_build_object('success', false, 'error', 'Charge amount exceeds available deposit');
  END IF;
  
  -- Determine transaction type
  IF p_amount = v_remaining THEN
    v_transaction_type := 'full_charge';
  ELSE
    v_transaction_type := 'partial_charge';
  END IF;
  
  -- Update rental with charged amount
  UPDATE rental_requests
  SET 
    deposit_charged_amount = deposit_charged_amount + p_amount,
    deposit_status = CASE 
      WHEN (deposit_charged_amount + p_amount) = gear_deposit_amount THEN 'fully_charged'
      ELSE 'partially_charged'
    END
  WHERE id = p_rental_request_id;
  
  -- Create transaction record
  INSERT INTO deposit_transactions (rental_request_id, transaction_type, amount, reason, notes, processed_by)
  VALUES (p_rental_request_id, v_transaction_type, p_amount, p_reason, p_notes, auth.uid());
  
  RETURN jsonb_build_object('success', true, 'charged_amount', p_amount, 'remaining', v_remaining - p_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for gear owners to release deposit (manual override)
CREATE OR REPLACE FUNCTION release_deposit(
  p_rental_request_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_rental rental_requests%ROWTYPE;
  v_remaining numeric;
BEGIN
  -- Get rental details
  SELECT * INTO v_rental FROM rental_requests WHERE id = p_rental_request_id;
  
  -- Verify caller is the gear owner
  IF v_rental.gear_owner_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the gear owner can release deposits');
  END IF;
  
  -- Verify deposit is available to release
  IF v_rental.deposit_status NOT IN ('held', 'partially_charged') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit is not available to release');
  END IF;
  
  -- Calculate remaining amount
  v_remaining := v_rental.gear_deposit_amount - v_rental.deposit_charged_amount;
  
  -- Update rental
  UPDATE rental_requests
  SET 
    deposit_status = 'released',
    deposit_released_at = now()
  WHERE id = p_rental_request_id;
  
  -- Create transaction record
  INSERT INTO deposit_transactions (rental_request_id, transaction_type, amount, notes, processed_by)
  VALUES (p_rental_request_id, 'release', v_remaining, p_notes, auth.uid());
  
  RETURN jsonb_build_object('success', true, 'released_amount', v_remaining);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comments
COMMENT ON TABLE deposit_transactions IS 'Tracks all deposit-related transactions for rental security deposits';
COMMENT ON FUNCTION charge_deposit IS 'Allows gear owners to charge full or partial amounts from held security deposits';
COMMENT ON FUNCTION release_deposit IS 'Allows gear owners to manually release held security deposits';
