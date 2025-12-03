-- Drop the existing create_rental_request function to resolve conflicts
DROP FUNCTION IF EXISTS public.create_rental_request(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.create_rental_request(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TIMESTAMPTZ);

-- Recreate the function without meeting_time parameter for now
CREATE OR REPLACE FUNCTION public.create_rental_request(
  p_renter_id UUID,
  p_gear_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_location TEXT,
  p_protection_type TEXT,
  p_insurance_cost NUMERIC,
  p_gear_title TEXT,
  p_gear_image_url TEXT,
  p_gear_daily_rate NUMERIC,
  p_gear_deposit_amount NUMERIC,
  p_gear_owner_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the function creator (postgres)
AS $$
DECLARE
  v_rental_id UUID;
  v_owner_id UUID;
BEGIN
  -- Derive owner_id to satisfy RLS policies referencing gear_owner_id
  SELECT owner_id INTO v_owner_id FROM public.gear_listings WHERE id = p_gear_id;

  -- 1. Insert the rental request
  INSERT INTO public.rental_requests (
    renter_id,
    gear_id,
    start_time,
    end_time,
    status,
    location,
    protection_type,
    insurance_cost,
    gear_title,
    gear_image_url,
    gear_daily_rate,
    gear_deposit_amount,
    gear_owner_name,
    gear_owner_id
  ) VALUES (
    p_renter_id,
    p_gear_id,
    p_start_time,
    p_end_time,
    'pending', -- Initial status
    p_location,
    p_protection_type,
    p_insurance_cost,
    p_gear_title,
    p_gear_image_url,
    p_gear_daily_rate,
    p_gear_deposit_amount,
    p_gear_owner_name,
    v_owner_id
  )
  RETURNING id INTO v_rental_id;

  -- 2. Mark the gear as unavailable
  UPDATE public.gear_listings
  SET is_available = false
  WHERE id = p_gear_id;

  RETURN v_rental_id;
END;
$$;