DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname, c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind IN ('r','v','p') LOOP
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.relname);
    IF t.relkind = 'v' THEN
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t.relname);
    ELSE
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.relname);
    END IF;
  END LOOP;
END $$;

GRANT SELECT ON public.restaurants TO anon;
GRANT SELECT ON public.restaurant_locations TO anon;
GRANT SELECT ON public.menu_items TO anon;
GRANT SELECT ON public.delivery_areas TO anon;
GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT ON public.promo_codes TO anon;

DO $$
DECLARE s record;
BEGIN
  FOR s IN SELECT sequencename FROM pg_sequences WHERE schemaname='public' LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO authenticated, service_role', s.sequencename);
  END LOOP;
END $$;