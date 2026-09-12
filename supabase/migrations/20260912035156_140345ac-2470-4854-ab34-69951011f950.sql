DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind IN ('r','v')
  LOOP
    EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.%I FROM anon, authenticated', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, SELECT ON public.%I FROM anon', t);
  END LOOP;
END $$;

GRANT SELECT ON public.menu_items TO anon;
GRANT SELECT ON public.delivery_areas TO anon;
GRANT SELECT ON public.peak_surcharge_windows TO anon;
GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT ON public.push_config TO anon;

GRANT SELECT (
  id, name, description, logo, location, cuisine, rating, delivery_time, min_order,
  is_active, created_at, lat, lng, logo_url, banner_url, gallery_images, opens_at,
  closes_at, contact_number, operating_days, is_open, total_reviews, image_url,
  area_id, requires_confirmation, approval_mode, confirmation_timeout_minutes
) ON public.restaurants TO anon;
