
-- Create storage bucket for driver documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-documents', 'driver-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Drivers can upload own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'driver-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow drivers to view their own documents  
CREATE POLICY "Drivers can view own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow drivers to update their own documents
CREATE POLICY "Drivers can update own documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read for document URLs
CREATE POLICY "Public read driver documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'driver-documents');
