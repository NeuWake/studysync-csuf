
-- Make event-images bucket private
UPDATE storage.buckets SET public = false WHERE id = 'event-images';

-- Drop any existing overly permissive policies on storage.objects for this bucket
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public access to event images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view event images" ON storage.objects;

-- Users can upload event images to their own folder
CREATE POLICY "Users can upload event images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'event-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can view event images (all authenticated users, since events may be shared)
CREATE POLICY "Authenticated users can view event images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'event-images');

-- Users can update their own event images
CREATE POLICY "Users can update own event images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'event-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own event images
CREATE POLICY "Users can delete own event images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'event-images' AND auth.uid()::text = (storage.foldername(name))[1]);
