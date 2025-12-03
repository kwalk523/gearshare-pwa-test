-- Add completed_at column to rental_requests table for completion tracking

-- Add completed_at column to track when the rental was actually completed
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_rental_requests_completed_at ON rental_requests(completed_at);

-- Add comment for documentation
COMMENT ON COLUMN rental_requests.completed_at IS 'Timestamp when the rental was marked as completed';