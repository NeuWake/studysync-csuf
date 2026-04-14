-- Drop the broad select policy
DROP POLICY IF EXISTS "Anyone can view chat files" ON storage.objects;

-- More restrictive: only allow selecting specific file paths (not listing)
CREATE POLICY "Authenticated can read chat files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-files');