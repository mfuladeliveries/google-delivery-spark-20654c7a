
-- Keep driver_service_areas (used by dispatch) in sync with driver_profiles.service_area_id (set by the picker UI).
-- 1) Backfill: ensure each driver with a service_area_id has exactly that row in driver_service_areas.
DELETE FROM public.driver_service_areas dsa
USING public.driver_profiles dp
WHERE dsa.driver_id = dp.user_id
  AND dp.service_area_id IS NOT NULL
  AND dsa.area_id <> dp.service_area_id;

INSERT INTO public.driver_service_areas (driver_id, area_id)
SELECT dp.user_id, dp.service_area_id
FROM public.driver_profiles dp
WHERE dp.service_area_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.driver_service_areas dsa
    WHERE dsa.driver_id = dp.user_id AND dsa.area_id = dp.service_area_id
  );

-- 2) Trigger: whenever service_area_id changes, mirror it into driver_service_areas.
CREATE OR REPLACE FUNCTION public.sync_driver_service_area()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.service_area_id IS DISTINCT FROM OLD.service_area_id THEN
    DELETE FROM public.driver_service_areas WHERE driver_id = NEW.user_id;
    IF NEW.service_area_id IS NOT NULL THEN
      INSERT INTO public.driver_service_areas (driver_id, area_id)
      VALUES (NEW.user_id, NEW.service_area_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_driver_service_area ON public.driver_profiles;
CREATE TRIGGER trg_sync_driver_service_area
AFTER INSERT OR UPDATE OF service_area_id ON public.driver_profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_driver_service_area();
