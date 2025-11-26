-- Phase 3: Promo Code System
-- Allows admins to create promotional discount codes; users can apply them during checkout.

-- 1. Create promo_codes table
CREATE TABLE IF NOT EXISTS promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL CHECK (LENGTH(code) >= 3),
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  max_uses integer DEFAULT NULL, -- NULL = unlimited
  current_uses integer DEFAULT 0,
  min_rental_amount numeric DEFAULT 0,
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  notes text
);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- RLS: Public read of active promo codes (so users can validate codes)
CREATE POLICY "Public read active promo codes" ON promo_codes FOR SELECT TO authenticated
  USING (is_active = true AND (valid_until IS NULL OR valid_until > now()));

-- RLS: Only service role or admins can insert/update promo codes
CREATE POLICY "Service role manages promo codes" ON promo_codes FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Create promo_code_usage table (tracks who used which code when)
CREATE TABLE IF NOT EXISTS promo_code_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  rental_id uuid REFERENCES rental_requests(id), -- optional link to rental
  discount_applied numeric NOT NULL,
  used_at timestamptz DEFAULT now()
);

ALTER TABLE promo_code_usage ENABLE ROW LEVEL SECURITY;

-- RLS: Users view their own usage
CREATE POLICY "Users view own promo usage" ON promo_code_usage FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- RLS: Service role inserts usage records
CREATE POLICY "Service role inserts usage" ON promo_code_usage FOR INSERT TO service_role
  WITH CHECK (true);

-- 3. Function: Validate and apply promo code
CREATE OR REPLACE FUNCTION apply_promo_code(
  p_code text,
  p_user_id uuid,
  p_rental_amount numeric
)
RETURNS TABLE(valid boolean, discount_amount numeric, error_message text) AS $$
DECLARE
  v_promo promo_codes;
  v_discount numeric := 0;
BEGIN
  -- Find active promo code
  SELECT * INTO v_promo FROM promo_codes
  WHERE UPPER(code) = UPPER(p_code)
    AND is_active = true
    AND (valid_from IS NULL OR valid_from <= now())
    AND (valid_until IS NULL OR valid_until > now());

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::numeric, 'Invalid or expired promo code'::text;
    RETURN;
  END IF;

  -- Check usage limit
  IF v_promo.max_uses IS NOT NULL AND v_promo.current_uses >= v_promo.max_uses THEN
    RETURN QUERY SELECT false, 0::numeric, 'Promo code usage limit reached'::text;
    RETURN;
  END IF;

  -- Check minimum rental amount
  IF p_rental_amount < v_promo.min_rental_amount THEN
    RETURN QUERY SELECT false, 0::numeric, ('Minimum rental amount $' || v_promo.min_rental_amount::text || ' required')::text;
    RETURN;
  END IF;

  -- Calculate discount
  IF v_promo.discount_type = 'percentage' THEN
    v_discount := p_rental_amount * (v_promo.discount_value / 100.0);
  ELSIF v_promo.discount_type = 'fixed' THEN
    v_discount := LEAST(v_promo.discount_value, p_rental_amount);
  END IF;

  -- Increment usage count
  UPDATE promo_codes SET current_uses = current_uses + 1 WHERE id = v_promo.id;

  -- Log usage
  INSERT INTO promo_code_usage (promo_code_id, user_id, discount_applied)
  VALUES (v_promo.id, p_user_id, v_discount);

  RETURN QUERY SELECT true, v_discount, ''::text;
END;$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function: Create promo code (admin/service role only)
CREATE OR REPLACE FUNCTION create_promo_code(
  p_code text,
  p_discount_type text,
  p_discount_value numeric,
  p_max_uses integer DEFAULT NULL,
  p_min_rental_amount numeric DEFAULT 0,
  p_valid_until timestamptz DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_promo_id uuid;
BEGIN
  INSERT INTO promo_codes (code, discount_type, discount_value, max_uses, min_rental_amount, valid_until, notes, created_by)
  VALUES (UPPER(p_code), p_discount_type, p_discount_value, p_max_uses, p_min_rental_amount, p_valid_until, p_notes, p_created_by)
  RETURNING id INTO v_promo_id;
  
  RETURN v_promo_id;
END;$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Function: Deactivate promo code
CREATE OR REPLACE FUNCTION deactivate_promo_code(p_code_id uuid)
RETURNS boolean AS $$
BEGIN
  UPDATE promo_codes SET is_active = false WHERE id = p_code_id;
  RETURN true;
END;$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE promo_codes IS 'Promotional discount codes for rentals';
COMMENT ON TABLE promo_code_usage IS 'Log of promo code applications';
COMMENT ON FUNCTION apply_promo_code IS 'Validate promo code and calculate discount for a rental';
COMMENT ON FUNCTION create_promo_code IS 'Admin function to create new promo codes';
COMMENT ON FUNCTION deactivate_promo_code IS 'Deactivate a promo code by ID';
