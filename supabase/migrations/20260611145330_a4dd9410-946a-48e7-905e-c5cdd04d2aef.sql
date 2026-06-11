
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname AS n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='public' AND c.relkind='r' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.n);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.n);
  END LOOP;
END $$;

GRANT SELECT ON public.restaurants TO anon;
GRANT SELECT ON public.menu_items TO anon;
GRANT SELECT ON public.delivery_areas TO anon;
GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT ON public.peak_surcharge_windows TO anon;
GRANT SELECT ON public.push_config TO anon;

-- Restore grants on the driver_orders view as well
GRANT SELECT ON public.driver_orders TO authenticated;
GRANT ALL ON public.driver_orders TO service_role;
