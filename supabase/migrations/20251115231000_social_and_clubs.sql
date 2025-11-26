/*
  # Social graph & Clubs

  Tables:
    - clubs: registered student organizations
    - club_memberships: many-to-many between profiles and clubs
    - profile_connections: peer connections between students

  Includes RLS and basic policies for a safe MVP.
*/

-- Clubs
CREATE TABLE IF NOT EXISTS public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  category text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid duplicates on re-run
DROP POLICY IF EXISTS "Clubs are viewable by authenticated users" ON public.clubs;
DROP POLICY IF EXISTS "Users can create clubs" ON public.clubs;
DROP POLICY IF EXISTS "Club owner can update" ON public.clubs;
DROP POLICY IF EXISTS "Club owner can delete" ON public.clubs;

-- Everyone authenticated can see clubs
CREATE POLICY "Clubs are viewable by authenticated users"
  ON public.clubs FOR SELECT
  TO authenticated
  USING (true);

-- Any authenticated user can create a club (MVP)
CREATE POLICY "Users can create clubs"
  ON public.clubs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Club owner can update/delete
CREATE POLICY "Club owner can update"
  ON public.clubs FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Club owner can delete"
  ON public.clubs FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Club memberships
CREATE TABLE IF NOT EXISTS public.club_memberships (
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text DEFAULT 'member' CHECK (role IN ('member','admin')),
  status text DEFAULT 'approved' CHECK (status IN ('pending','approved')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (club_id, profile_id)
);

ALTER TABLE public.club_memberships ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid duplicates on re-run
DROP POLICY IF EXISTS "Memberships readable" ON public.club_memberships;
DROP POLICY IF EXISTS "Users can join clubs" ON public.club_memberships;
DROP POLICY IF EXISTS "Users can leave clubs" ON public.club_memberships;
DROP POLICY IF EXISTS "Club owner can update memberships" ON public.club_memberships;

-- Members and authenticated users can read membership list (MVP: open to authenticated)
CREATE POLICY "Memberships readable"
  ON public.club_memberships FOR SELECT
  TO authenticated
  USING (true);

-- Users can join/leave themselves
CREATE POLICY "Users can join clubs"
  ON public.club_memberships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can leave clubs"
  ON public.club_memberships FOR DELETE
  TO authenticated
  USING (auth.uid() = profile_id);

-- Club admins (creator for MVP) can update membership status/role
CREATE POLICY "Club owner can update memberships"
  ON public.club_memberships FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_memberships.club_id AND c.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_memberships.club_id AND c.created_by = auth.uid()));

-- Profile connections
CREATE TABLE IF NOT EXISTS public.profile_connections (
  requester_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (requester_id, addressee_id)
);

ALTER TABLE public.profile_connections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid duplicates on re-run
DROP POLICY IF EXISTS "Participants can read connections" ON public.profile_connections;
DROP POLICY IF EXISTS "Requester can create connection" ON public.profile_connections;
DROP POLICY IF EXISTS "Participants can update connection" ON public.profile_connections;
DROP POLICY IF EXISTS "Participants can delete connection" ON public.profile_connections;

-- Only participants can read connection rows
CREATE POLICY "Participants can read connections"
  ON public.profile_connections FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Only requester can create a request
CREATE POLICY "Requester can create connection"
  ON public.profile_connections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

-- Requester can cancel, addressee can accept/decline via update/delete
CREATE POLICY "Participants can update connection"
  ON public.profile_connections FOR UPDATE
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Participants can delete connection"
  ON public.profile_connections FOR DELETE
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
