CREATE OR REPLACE FUNCTION public.check_area_coverage(
  p_lat double precision,
  p_lng double precision,
  p_address text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_online_in_area integer := 0;
  v_total_online integer := 0;
BEGIN
  SELECT count(*) INTO v_total_online
  FROM public.driver_profiles
  WHERE is_online = true;

  IF p_address IS NULL OR length(trim(p_address)) = 0 THEN
    RETURN jsonb_build_object(
      'covered', v_total_online > 0,
      'online_in_area', v_total_online,
      'total_online', v_total_online
    );
  END IF;

  SELECT count(*) INTO v_online_in_area
  FROM public.driver_profiles dp
  JOIN public.delivery_areas da ON da.id = dp.service_area_id AND da.is_active = true
  WHERE dp.is_online = true
    AND (
      position(lower(da.name) IN lower(p_address)) > 0
      OR (da.suburb <> '' AND position(lower(da.suburb) IN lower(p_address)) > 0)
    );

  RETURN jsonb_build_object(
    'covered', v_online_in_area > 0,
    'online_in_area', v_online_in_area,
    'total_online', v_total_online
  );
END;
$function$;