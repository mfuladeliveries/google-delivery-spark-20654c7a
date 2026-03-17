
-- Create public storage bucket for food images
INSERT INTO storage.buckets (id, name, public)
VALUES ('food-images', 'food-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated restaurant owners and admins to upload food images
CREATE POLICY "Restaurant owners and admins can upload food images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'food-images'
  AND (
    has_role(auth.uid(), 'restaurant'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Allow authenticated restaurant owners and admins to update food images
CREATE POLICY "Restaurant owners and admins can update food images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'food-images'
  AND (
    has_role(auth.uid(), 'restaurant'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Allow authenticated restaurant owners and admins to delete food images
CREATE POLICY "Restaurant owners and admins can delete food images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'food-images'
  AND (
    has_role(auth.uid(), 'restaurant'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Allow anyone to view food images (public bucket)
CREATE POLICY "Anyone can view food images"
ON storage.objects FOR SELECT
USING (bucket_id = 'food-images');
