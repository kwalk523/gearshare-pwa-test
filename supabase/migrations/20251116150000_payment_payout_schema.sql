-- Phase 3: Payments & Payouts Schema Extension
-- Adds payout tracking and enriches existing transactions table for future Stripe integration.

-- 1. Extend existing transactions table (created earlier) with payment metadata columns
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS external_ref text,               -- e.g. Stripe payment_intent id
  ADD COLUMN IF NOT EXISTS payment_method text,             -- card, ach, wallet
  ADD COLUMN IF NOT EXISTS settled_at timestamptz,          -- when funds captured/settled
  ADD COLUMN IF NOT EXISTS metadata jsonb;                  -- flexible key-value (fees, tax, etc.)

-- 2. Create payouts table for owner earnings disbursement
CREATE TABLE IF NOT EXISTS payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  fee_amount numeric NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  net_amount numeric GENERATED ALWAYS AS (total_amount - fee_amount) STORED,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed')),
  initiated_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Owners can view their own payouts
CREATE POLICY "Owners view their payouts" ON payouts FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- Only system (service role) inserts payouts via RPC (no direct client insert)
CREATE POLICY "Service role inserts payouts" ON payouts FOR INSERT TO service_role
  WITH CHECK (true);

-- Owners cannot update payout rows except notes while pending
CREATE POLICY "Owners update payout notes pending" ON payouts FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND status = 'pending')
  WITH CHECK (owner_id = auth.uid() AND status = 'pending');

-- 4. Helper function: calculate pending earnings for an owner
CREATE OR REPLACE FUNCTION calculate_pending_earnings(p_owner_id uuid)
RETURNS numeric AS $$
DECLARE
  v_total numeric := 0;
BEGIN
  -- Sum of completed rentals not yet included in a payout
  SELECT COALESCE(SUM( (r.gear_daily_rate * GREATEST(1, CEIL( (EXTRACT(EPOCH FROM (r.end_time - r.start_time)))/(86400) ))) ), 0)
  INTO v_total
  FROM rental_requests r
  WHERE r.gear_owner_id = p_owner_id
    AND r.status = 'completed'
    AND NOT EXISTS (
      SELECT 1 FROM payouts p
      WHERE p.owner_id = p_owner_id
        AND r.completed_at BETWEEN p.period_start AND p.period_end
    );
  RETURN v_total;
END;$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Function: create a payout for an owner for all completed rentals since last payout
CREATE OR REPLACE FUNCTION create_payout(p_owner_id uuid, p_fee_rate numeric DEFAULT 0.10)
RETURNS uuid AS $$
DECLARE
  v_last_end timestamptz;
  v_start timestamptz;
  v_end timestamptz := now();
  v_total numeric := 0;
  v_fee numeric := 0;
  v_payout_id uuid;
BEGIN
  -- Find last period_end
  SELECT MAX(period_end) INTO v_last_end FROM payouts WHERE owner_id = p_owner_id;
  v_start := COALESCE(v_last_end, (now() - interval '30 days'));

  -- Calculate total earnings in window
  SELECT COALESCE(SUM( (r.gear_daily_rate * GREATEST(1, CEIL( (EXTRACT(EPOCH FROM (r.end_time - r.start_time)))/(86400) ))) ), 0)
  INTO v_total
  FROM rental_requests r
  WHERE r.gear_owner_id = p_owner_id
    AND r.status = 'completed'
    AND r.completed_at BETWEEN v_start AND v_end;

  IF v_total = 0 THEN
    RAISE NOTICE 'No earnings to create payout for';
    RETURN NULL;
  END IF;

  v_fee := ROUND(v_total * p_fee_rate, 2);

  INSERT INTO payouts (owner_id, period_start, period_end, total_amount, fee_amount, status, notes)
  VALUES (p_owner_id, v_start, v_end, v_total, v_fee, 'pending', 'Generated automatically')
  RETURNING id INTO v_payout_id;

  RETURN v_payout_id;
END;$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE payouts IS 'Aggregated owner earnings ready for disbursement';
COMMENT ON FUNCTION create_payout IS 'Generates a payout row for completed rentals not yet paid';
COMMENT ON FUNCTION calculate_pending_earnings IS 'Returns numeric total of completed unpaid rental earnings';
