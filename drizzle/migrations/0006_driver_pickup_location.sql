CREATE OR REPLACE FUNCTION public.driver_pickup_location(p_order_id uuid)
RETURNS TABLE(branch_name text, address text, lat double precision, lng double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(rl.branch_name, r.name), COALESCE(NULLIF(rl.address,''), r.location),
         COALESCE(rl.lat, r.lat), COALESCE(rl.lng, r.lng)
  FROM public.orders o
  LEFT JOIN public.restaurant_locations rl ON rl.id = o.restaurant_location_id
  LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE o.id = p_order_id
    AND (o.driver_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
$$;
REVOKE ALL ON FUNCTION public.driver_pickup_location(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_pickup_location(uuid) TO authenticated, service_role;