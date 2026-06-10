
-- 1) Restaurants: prevent anon/authenticated from reading owner_user_id via the public listing.
REVOKE SELECT ON public.restaurants FROM anon;
REVOKE SELECT ON public.restaurants FROM authenticated;

GRANT SELECT (
  id, name, description, logo, location, cuisine, rating, delivery_time,
  min_order, is_active, created_at, lat, lng, logo_url, banner_url,
  gallery_images, opens_at, closes_at, contact_number, operating_days,
  is_open, total_reviews, image_url, area_id, requires_confirmation,
  approval_mode, confirmation_timeout_minutes
) ON public.restaurants TO anon;

GRANT SELECT (
  id, name, description, logo, location, cuisine, rating, delivery_time,
  min_order, is_active, created_at, lat, lng, logo_url, banner_url,
  gallery_images, opens_at, closes_at, contact_number, operating_days,
  is_open, total_reviews, image_url, area_id, requires_confirmation,
  approval_mode, confirmation_timeout_minutes, owner_user_id
) ON public.restaurants TO authenticated;

-- 2) Remove customer_favourites from realtime publication (RLS scopes per-user,
--    and we don't need realtime sync for favourites).
ALTER PUBLICATION supabase_realtime DROP TABLE public.customer_favourites;
