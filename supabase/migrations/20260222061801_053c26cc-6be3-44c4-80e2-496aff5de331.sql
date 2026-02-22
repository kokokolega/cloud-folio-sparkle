
-- Create a storage bucket for background images
INSERT INTO storage.buckets (id, name, public)
VALUES ('background-images', 'background-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own background images
CREATE POLICY "Users can upload their own background images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'background-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to update their own background images
CREATE POLICY "Users can update their own background images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'background-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to delete their own background images
CREATE POLICY "Users can delete their own background images"
ON storage.objects FOR DELETE
USING (bucket_id = 'background-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access to background images
CREATE POLICY "Background images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'background-images');
