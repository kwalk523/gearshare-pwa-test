-- Allow service_role (used internally by auth signup + trigger) to insert into profiles
-- Fix for: AuthApiError: Database error saving new user (trigger blocked by RLS)

CREATE POLICY IF NOT EXISTS "Service role can insert profiles"
  ON profiles FOR INSERT
  TO service_role
  WITH CHECK (true);
