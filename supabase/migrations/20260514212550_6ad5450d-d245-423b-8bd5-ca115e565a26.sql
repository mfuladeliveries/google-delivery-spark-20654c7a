REVOKE SELECT ON public.restaurants FROM anon;
GRANT SELECT (
  id, name, description, logo, location, cuisine, rating, delivery_time, min_order,
  is_active, created_at, lat, lng, logo_url, banner_url, gallery_images,
  opens_at, closes_at, contact_number, operating_days, is_open, total_reviews,
  image_url, area_id, requires_confirmation, approval_mode, confirmation_timeout_minutes
) ON public.restaurants TO anon;