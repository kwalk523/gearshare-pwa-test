-- Fix storage policies for gear-images and gear-returns buckets

-- 1. Ensure buckets exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('gear-images', 'gear-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('gear-returns', 'gear-returns', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies to avoid conflicts (and ensure we have the correct ones)
DROP POLICY IF EXISTS "Authenticated users can upload gear images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view gear images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload return images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view return images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own gear images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own gear images" ON storage.objects;

-- 3. Create policies for gear-images
-- Allow any authenticated user to upload images (for listing gear)
CREATE POLICY "Authenticated users can upload gear images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'gear-images');

-- Allow public access to view images
CREATE POLICY "Public can view gear images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'gear-images');

-- Allow users to update/delete their own images (optional but good practice)
CREATE POLICY "Users can update own gear images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'gear-images' AND owner = auth.uid());

CREATE POLICY "Users can delete own gear images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'gear-images' AND owner = auth.uid());


-- 4. Create policies for gear-returns
-- Allow any authenticated user to upload return/condition photos
CREATE POLICY "Authenticated users can upload return images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'gear-returns');

-- Allow public access to view return images (needed for getPublicUrl)
CREATE POLICY "Public can view return images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'gear-returns');
