
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders" ON public.orders
FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = customer_id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

REVOKE SELECT ON public.restaurants FROM anon;
GRANT SELECT (
  id, name, description, logo, location, cuisine, rating, delivery_time,
  min_order, is_active, created_at, lat, lng, logo_url, banner_url,
  gallery_images, opens_at, closes_at, contact_number, operating_days,
  is_open, total_reviews, image_url, area_id, requires_confirmation,
  approval_mode, confirmation_timeout_minutes
) ON public.restaurants TO anon;
