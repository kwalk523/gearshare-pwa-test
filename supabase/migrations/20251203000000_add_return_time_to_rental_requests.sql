-- Add return_time and return_status columns to rental_requests table for return workflow

-- Add return_time column to track when the return is scheduled
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS return_time timestamptz;

-- Add return_status column to track the return workflow state
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS return_status text DEFAULT 'not_started'
  CHECK (return_status IN ('not_started', 'scheduled', 'meeting_confirmed', 'completed', 'disputed'));

-- Add inspection_notes column for return inspection details
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS inspection_notes text;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_rental_requests_return_time ON rental_requests(return_time);
CREATE INDEX IF NOT EXISTS idx_rental_requests_return_status ON rental_requests(return_status);

-- Add comments for documentation
COMMENT ON COLUMN rental_requests.return_time IS 'Scheduled time for item return meeting';
COMMENT ON COLUMN rental_requests.return_status IS 'Current status of the return workflow process';
COMMENT ON COLUMN rental_requests.inspection_notes IS 'Notes from item condition inspection during return';