CREATE OR REPLACE FUNCTION public.get_restaurants_for_location(p_lat double precision, p_lng double precision)
 RETURNS TABLE(area_id uuid, area_name text, restaurant_id uuid, restaurant_name text, branch_id uuid, branch_name text, branch_address text, branch_lat double precision, branch_lng double precision, delivery_fee numeric, estimated_delivery_time text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_area_id uuid; v_area_name text;
BEGIN
  SELECT da.id, da.name INTO v_area_id, v_area_name
  FROM public.delivery_areas da
  WHERE da.is_active AND da.lat IS NOT NULL AND da.lng IS NOT NULL
    AND public.distance_km(da.lat, da.lng, p_lat, p_lng) <= da.radius_km
  ORDER BY public.distance_km(da.lat, da.lng, p_lat, p_lng) LIMIT 1;
  IF v_area_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT * FROM (
    SELECT DISTINCT ON (r.id)
      v_area_id, v_area_name, r.id, r.name, rl.id, rl.branch_name, rl.address, rl.lat, rl.lng,
      rl.delivery_fee, COALESCE(rl.estimated_delivery_time, r.delivery_time)
    FROM public.restaurants r
    JOIN public.restaurant_locations rl ON rl.restaurant_id = r.id
    WHERE rl.area_id = v_area_id AND r.is_active AND rl.active AND rl.delivery_enabled
      AND COALESCE(rl.is_open, true)
      AND rl.lat IS NOT NULL AND rl.lng IS NOT NULL
    ORDER BY r.id, public.distance_km(rl.lat, rl.lng, p_lat, p_lng)
  ) s ORDER BY 4;
END;
$function$;

CREATE UNIQUE INDEX IF NOT EXISTS restaurants_active_name_uniq
  ON public.restaurants (lower(trim(name))) WHERE is_active;