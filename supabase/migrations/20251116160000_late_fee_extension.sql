-- Phase 3: Late Fee & Extension Logic
-- Tracks overdue rentals, accrues late fees, and allows renters to request extensions with associated payments.

-- 1. Extend rental_requests with late fee tracking
ALTER TABLE rental_requests
  ADD COLUMN IF NOT EXISTS late_fee_accrued numeric DEFAULT 0 CHECK (late_fee_accrued >= 0),
  ADD COLUMN IF NOT EXISTS is_overdue boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS overdue_since timestamptz,
  ADD COLUMN IF NOT EXISTS extension_count integer DEFAULT 0;

-- 2. Create extension_requests table
CREATE TABLE IF NOT EXISTS extension_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES rental_requests(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES profiles(id),
  new_end_time timestamptz NOT NULL,
  additional_days integer NOT NULL CHECK (additional_days > 0),
  extension_cost numeric NOT NULL CHECK (extension_cost >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE extension_requests ENABLE ROW LEVEL SECURITY;

-- RLS: Renters view their own extension requests
CREATE POLICY "Renters view own extension requests" ON extension_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid());

-- RLS: Renters insert extension requests
CREATE POLICY "Renters create extension requests" ON extension_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

-- RLS: Owners view extension requests for their gear
CREATE POLICY "Owners view extension requests for gear" ON extension_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rental_requests rr
      WHERE rr.id = extension_requests.rental_id AND rr.gear_owner_id = auth.uid()
    )
  );

-- RLS: Owners update extension request status (approve/reject)
CREATE POLICY "Owners update extension status" ON extension_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rental_requests rr
      WHERE rr.id = extension_requests.rental_id AND rr.gear_owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rental_requests rr
      WHERE rr.id = extension_requests.rental_id AND rr.gear_owner_id = auth.uid()
    )
  );

-- 3. Function: Calculate late fees for a rental (daily rate * days overdue * penalty multiplier)
CREATE OR REPLACE FUNCTION calculate_late_fee(p_rental_id uuid, p_penalty_rate numeric DEFAULT 1.5)
RETURNS numeric AS $$
DECLARE
  v_rental rental_requests;
  v_days_overdue integer;
  v_daily_rate numeric;
  v_fee numeric := 0;
BEGIN
  SELECT * INTO v_rental FROM rental_requests WHERE id = p_rental_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Only calculate if rental is active and past end_time
  IF v_rental.status = 'active' AND v_rental.end_time < now() THEN
    v_days_overdue := CEIL(EXTRACT(EPOCH FROM (now() - v_rental.end_time)) / 86400);
    v_daily_rate := COALESCE(v_rental.gear_daily_rate, 0);
    v_fee := v_daily_rate * v_days_overdue * p_penalty_rate;
  END IF;

  RETURN GREATEST(0, v_fee);
END;$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function: Update overdue status and accrue late fees for all active rentals
CREATE OR REPLACE FUNCTION update_overdue_rentals()
RETURNS TABLE(rental_id uuid, new_fee numeric) AS $$
DECLARE
  r rental_requests;
  v_fee numeric;
BEGIN
  FOR r IN SELECT * FROM rental_requests WHERE status = 'active' AND end_time < now()
  LOOP
    v_fee := calculate_late_fee(r.id);
    UPDATE rental_requests
      SET is_overdue = true,
          overdue_since = COALESCE(overdue_since, r.end_time),
          late_fee_accrued = v_fee
      WHERE id = r.id;
    
    rental_id := r.id;
    new_fee := v_fee;
    RETURN NEXT;
  END LOOP;
END;$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Function: Request extension (renter)
CREATE OR REPLACE FUNCTION request_extension(
  p_rental_id uuid,
  p_additional_days integer,
  p_requester_id uuid
)
RETURNS uuid AS $$
DECLARE
  v_rental rental_requests;
  v_daily_rate numeric;
  v_cost numeric;
  v_new_end timestamptz;
  v_ext_id uuid;
BEGIN
  SELECT * INTO v_rental FROM rental_requests WHERE id = p_rental_id;
  IF NOT FOUND OR v_rental.renter_id != p_requester_id THEN
    RAISE EXCEPTION 'Rental not found or not owned by requester';
  END IF;

  v_daily_rate := COALESCE(v_rental.gear_daily_rate, 0);
  v_cost := v_daily_rate * p_additional_days;
  v_new_end := v_rental.end_time + (p_additional_days || ' days')::interval;

  INSERT INTO extension_requests (rental_id, requester_id, new_end_time, additional_days, extension_cost, status)
  VALUES (p_rental_id, p_requester_id, v_new_end, p_additional_days, v_cost, 'pending')
  RETURNING id INTO v_ext_id;

  RETURN v_ext_id;
END;$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function: Approve extension (owner)
CREATE OR REPLACE FUNCTION approve_extension(p_extension_id uuid, p_owner_id uuid)
RETURNS boolean AS $$
DECLARE
  v_ext extension_requests;
  v_rental rental_requests;
BEGIN
  SELECT * INTO v_ext FROM extension_requests WHERE id = p_extension_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Extension request not found';
  END IF;

  SELECT * INTO v_rental FROM rental_requests WHERE id = v_ext.rental_id;
  IF v_rental.gear_owner_id != p_owner_id THEN
    RAISE EXCEPTION 'Owner mismatch';
  END IF;

  -- Update extension status
  UPDATE extension_requests SET status = 'approved', resolved_at = now() WHERE id = p_extension_id;

  -- Update rental end_time and increment extension count
  UPDATE rental_requests
    SET end_time = v_ext.new_end_time,
        extension_count = extension_count + 1,
        is_overdue = false,
        overdue_since = NULL
    WHERE id = v_ext.rental_id;

  RETURN true;
END;$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function: Reject extension (owner)
CREATE OR REPLACE FUNCTION reject_extension(p_extension_id uuid, p_owner_id uuid, p_notes text DEFAULT NULL)
RETURNS boolean AS $$
DECLARE
  v_ext extension_requests;
  v_rental rental_requests;
BEGIN
  SELECT * INTO v_ext FROM extension_requests WHERE id = p_extension_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Extension request not found';
  END IF;

  SELECT * INTO v_rental FROM rental_requests WHERE id = v_ext.rental_id;
  IF v_rental.gear_owner_id != p_owner_id THEN
    RAISE EXCEPTION 'Owner mismatch';
  END IF;

  UPDATE extension_requests SET status = 'rejected', resolved_at = now(), notes = p_notes WHERE id = p_extension_id;
  RETURN true;
END;$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE extension_requests IS 'Renter requests to extend rental periods';
COMMENT ON FUNCTION calculate_late_fee IS 'Computes late fee for an overdue rental';
COMMENT ON FUNCTION update_overdue_rentals IS 'Batch update overdue status and fees for all active rentals past end_time';
COMMENT ON FUNCTION request_extension IS 'Renter creates extension request with cost calculation';
COMMENT ON FUNCTION approve_extension IS 'Owner approves extension, updates rental end_time';
COMMENT ON FUNCTION reject_extension IS 'Owner rejects extension request';
