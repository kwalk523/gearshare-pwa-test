-- Add RLS policies for rental_requests so owners see pending requests
-- Timestamp: 2025-11-23 15:00:00

-- Enable RLS if not already enabled
ALTER TABLE rental_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid duplication
DROP POLICY IF EXISTS "Participants can view rental requests" ON rental_requests;
DROP POLICY IF EXISTS "Renters can create rental requests" ON rental_requests;
DROP POLICY IF EXISTS "Participants can update rental requests" ON rental_requests;

-- View policy: renter OR gear owner may see the row
CREATE POLICY "Participants can view rental requests"
  ON rental_requests FOR SELECT
  TO authenticated
  USING (renter_id = auth.uid() OR gear_owner_id = auth.uid());

-- Insert policy: renter inserts (owner via SECURITY DEFINER function doesn't need direct policy but harmless)
CREATE POLICY "Renters can create rental requests"
  ON rental_requests FOR INSERT
  TO authenticated
  WITH CHECK (renter_id = auth.uid());

-- Update policy: participants may update their rental request (e.g., status changes, condition images)
CREATE POLICY "Participants can update rental requests"
  ON rental_requests FOR UPDATE
  TO authenticated
  USING (renter_id = auth.uid() OR gear_owner_id = auth.uid())
  WITH CHECK (renter_id = auth.uid() OR gear_owner_id = auth.uid());

-- Backfill gear_owner_id for legacy rows missing it so owners gain visibility
UPDATE rental_requests r
SET gear_owner_id = gl.owner_id
FROM gear_listings gl
WHERE r.gear_id = gl.id AND r.gear_owner_id IS NULL;

-- Helpful index if not present (status + owner for dashboard queries)
CREATE INDEX IF NOT EXISTS idx_rental_requests_owner_status ON rental_requests(gear_owner_id, status);
