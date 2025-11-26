-- Supabase RPC: Cancel rental and make gear available (admin/SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.cancel_rental_and_make_gear_available(
  p_rental_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_gear_id UUID;
BEGIN
  -- Set rental status to cancelled
  UPDATE rental_requests
  SET status = 'cancelled'
  WHERE id = p_rental_id;

  -- Get the gear_id for this rental
  SELECT gear_id INTO v_gear_id FROM rental_requests WHERE id = p_rental_id;

  -- Set gear as available
  UPDATE gear_listings
  SET is_available = true
  WHERE id = v_gear_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.cancel_rental_and_make_gear_available(UUID) TO authenticated;
