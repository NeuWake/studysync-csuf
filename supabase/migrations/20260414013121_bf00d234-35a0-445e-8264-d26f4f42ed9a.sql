-- Add file columns to messages
ALTER TABLE public.messages
ADD COLUMN file_url text,
ADD COLUMN file_name text,
ADD COLUMN file_size integer,
ADD COLUMN file_type text;

-- Create storage bucket for chat files
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can upload to chat-files
CREATE POLICY "Authenticated users can upload chat files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-files');

-- Anyone can view chat files (bucket is public)
CREATE POLICY "Anyone can view chat files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-files');

-- Users can delete their own chat files
CREATE POLICY "Users can delete own chat files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-files' AND auth.uid()::text = (storage.foldername(name))[1]);