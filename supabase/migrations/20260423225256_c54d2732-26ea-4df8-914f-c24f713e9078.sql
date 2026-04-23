-- Add image columns to restaurants
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS gallery_images text[] NOT NULL DEFAULT ARRAY[]::text[];

-- Backfill: any existing logo string into logo_url
UPDATE public.restaurants
   SET logo_url = NULLIF(logo, '')
 WHERE logo_url IS NULL;

-- Storage policies for a dedicated 'restaurant-images' folder structure inside the existing
-- public 'food-images' bucket. Admins manage everything; restaurant owners manage their own folder.
-- Folder convention: restaurant-images/{restaurant_id}/{logo|banner|gallery}/...

DO $$
BEGIN
  -- Public read is already enabled by the existing "Anyone can view food images" policy.

  -- Admin: manage all restaurant-images
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Admins manage restaurant-images'
  ) THEN
    CREATE POLICY "Admins manage restaurant-images"
      ON storage.objects
      FOR ALL
      TO authenticated
      USING (bucket_id = 'food-images' AND has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (bucket_id = 'food-images' AND has_role(auth.uid(), 'admin'::app_role));
  END IF;
END$$;