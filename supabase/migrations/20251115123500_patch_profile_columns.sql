-- Patch: ensure all profile feature columns exist
-- Safe to re-run; uses IF NOT EXISTS guards

DO $$ 
BEGIN
    -- Music & Playlist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='profile_playlist') THEN
        ALTER TABLE profiles ADD COLUMN profile_playlist text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='profile_song') THEN
        ALTER TABLE profiles ADD COLUMN profile_song text;
    END IF;

    -- Basic Customization
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='profile_banner') THEN
        ALTER TABLE profiles ADD COLUMN profile_banner text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='profile_pic') THEN
        ALTER TABLE profiles ADD COLUMN profile_pic text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='theme') THEN
        ALTER TABLE profiles ADD COLUMN theme text DEFAULT 'emerald';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='favorite_quote') THEN
        ALTER TABLE profiles ADD COLUMN favorite_quote text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='font') THEN
        ALTER TABLE profiles ADD COLUMN font text DEFAULT 'font-sans';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ring_color') THEN
        ALTER TABLE profiles ADD COLUMN ring_color text DEFAULT 'white';
    END IF;

    -- Bio & Social Links
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='bio') THEN
        ALTER TABLE profiles ADD COLUMN bio text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='instagram') THEN
        ALTER TABLE profiles ADD COLUMN instagram text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='twitter') THEN
        ALTER TABLE profiles ADD COLUMN twitter text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='linkedin') THEN
        ALTER TABLE profiles ADD COLUMN linkedin text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='mood_status') THEN
        ALTER TABLE profiles ADD COLUMN mood_status text;
    END IF;

    -- Interests & Availability
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='interests') THEN
        ALTER TABLE profiles ADD COLUMN interests text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='availability_status') THEN
        ALTER TABLE profiles ADD COLUMN availability_status text DEFAULT 'available';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='availability_message') THEN
        ALTER TABLE profiles ADD COLUMN availability_message text;
    END IF;

    -- UCF Pride
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='major') THEN
        ALTER TABLE profiles ADD COLUMN major text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='grad_year') THEN
        ALTER TABLE profiles ADD COLUMN grad_year text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='clubs') THEN
        ALTER TABLE profiles ADD COLUMN clubs text;
    END IF;

    -- Practical Features
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='wishlist') THEN
        ALTER TABLE profiles ADD COLUMN wishlist text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='pickup_locations') THEN
        ALTER TABLE profiles ADD COLUMN pickup_locations text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='preferred_contact') THEN
        ALTER TABLE profiles ADD COLUMN preferred_contact text DEFAULT 'in-app';
    END IF;

    -- Badges & Stats
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='profile_views') THEN
        ALTER TABLE profiles ADD COLUMN profile_views integer DEFAULT 0;
    END IF;

    -- Timestamp
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='updated_at') THEN
        ALTER TABLE profiles ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;
END $$;
