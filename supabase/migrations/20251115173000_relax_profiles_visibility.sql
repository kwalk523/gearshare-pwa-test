-- Relax profiles visibility: allow all authenticated users to view all profiles
-- Safe to run multiple times

-- Drop narrower verified-only policy if present
DROP POLICY IF EXISTS "Users can view all verified profiles" ON profiles;

-- Create broad visibility policy
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);
