-- Restaurants: add missing fields
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS contact_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS operating_days jsonb NOT NULL DEFAULT '["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_open boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS total_reviews integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url text;

-- Menu items: add missing fields
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS is_popular boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_sizes boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS has_add_ons boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS add_ons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS image_url text;

-- Backfill image_url from existing image columns where null
UPDATE public.restaurants
SET image_url = COALESCE(image_url, banner_url, logo_url, logo)
WHERE image_url IS NULL;

UPDATE public.menu_items
SET image_url = COALESCE(image_url, image)
WHERE image_url IS NULL;

-- Allow admins to fully manage menu items (was restricted to owners + admins via has_role indirectly via restaurants check)
-- The existing policy already covers admins; no change needed.

-- Allow admins to insert/delete restaurants (existing "Admins can manage restaurants" ALL policy already covers this)