-- 1. Add service area columns to driver_profiles
ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS service_lat double precision,
  ADD COLUMN IF NOT EXISTS service_lng double precision,
  ADD COLUMN IF NOT EXISTS service_radius_km numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS service_area_label text NOT NULL DEFAULT '';

-- 2. RPC for customers/checkout: is any online driver covering this coordinate?
CREATE OR REPLACE FUNCTION public.check_area_coverage(p_lat double precision, p_lng double precision)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_online_in_area integer := 0;
  v_total_online integer := 0;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RETURN jsonb_build_object('covered', false, 'online_in_area', 0, 'total_online', 0);
  END IF;

  SELECT count(*) INTO v_total_online
  FROM public.driver_profiles
  WHERE is_online = true;

  SELECT count(*) INTO v_online_in_area
  FROM public.driver_profiles dp
  WHERE dp.is_online = true
    AND dp.service_lat IS NOT NULL
    AND dp.service_lng IS NOT NULL
    AND dp.service_radius_km > 0
    AND public.distance_km(dp.service_lat, dp.service_lng, p_lat, p_lng) <= dp.service_radius_km;

  RETURN jsonb_build_object(
    'covered', v_online_in_area > 0,
    'online_in_area', v_online_in_area,
    'total_online', v_total_online
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_area_coverage(double precision, double precision) TO anon, authenticated;

-- 3. Update dispatch_assign_next to filter by driver service-area coverage of the CUSTOMER location
CREATE OR REPLACE FUNCTION public.dispatch_assign_next(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_next_driver uuid;
  v_previous_driver uuid;
  v_new_phase text;
  v_offer_seconds integer := 180;
  v_max_km numeric := 10;
  v_rest_lat double precision;
  v_rest_lng double precision;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status NOT IN ('ready') OR v_order.driver_id IS NOT NULL THEN
    RETURN jsonb_build_object('phase', v_order.dispatch_phase, 'reason', 'not_dispatchable');
  END IF;

  v_previous_driver := v_order.offered_to_driver_id;

  IF v_previous_driver IS NOT NULL THEN
    UPDATE public.orders
    SET missed_by_driver_ids = array_append(COALESCE(missed_by_driver_ids, ARRAY[]::uuid[]), v_previous_driver)
    WHERE id = p_order_id
      AND NOT (v_previous_driver = ANY(COALESCE(missed_by_driver_ids, ARRAY[]::uuid[])));
    v_order.missed_by_driver_ids := array_append(COALESCE(v_order.missed_by_driver_ids, ARRAY[]::uuid[]), v_previous_driver);
  END IF;

  IF v_order.dispatch_phase IS NULL THEN
    v_new_phase := 'offer_a';
  ELSIF v_order.dispatch_phase = 'offer_a' THEN
    v_new_phase := 'offer_b';
  ELSE
    v_new_phase := 'waiting';
  END IF;

  IF v_order.restaurant_id IS NOT NULL THEN
    SELECT lat, lng INTO v_rest_lat, v_rest_lng
    FROM public.restaurants WHERE id = v_order.restaurant_id;
  END IF;

  IF v_new_phase IN ('offer_a', 'offer_b') THEN
    -- Pick the closest online driver whose service area COVERS the CUSTOMER location,
    -- AND who is within v_max_km of the restaurant (existing pickup constraint).
    SELECT dp.user_id INTO v_next_driver
    FROM public.driver_profiles dp
    WHERE dp.is_online = true
      AND dp.service_lat IS NOT NULL
      AND dp.service_lng IS NOT NULL
      AND dp.service_radius_km > 0
      AND v_order.customer_lat IS NOT NULL
      AND v_order.customer_lng IS NOT NULL
      AND public.distance_km(dp.service_lat, dp.service_lng, v_order.customer_lat, v_order.customer_lng) <= dp.service_radius_km
      AND NOT (dp.user_id = ANY(COALESCE(v_order.missed_by_driver_ids, ARRAY[]::uuid[])))
      AND NOT EXISTS (
        SELECT 1 FROM public.orders o2
        WHERE o2.driver_id = dp.user_id
          AND o2.status IN ('driver_assigned','picking_up','arrived_at_restaurant','out_for_delivery')
      )
      AND (
        v_rest_lat IS NULL OR v_rest_lng IS NULL
        OR dp.current_lat IS NULL OR dp.current_lng IS NULL
        OR public.distance_km(v_rest_lat, v_rest_lng, dp.current_lat, dp.current_lng) <= v_max_km
      )
    ORDER BY
      CASE WHEN v_rest_lat IS NOT NULL AND dp.current_lat IS NOT NULL
           THEN public.distance_km(v_rest_lat, v_rest_lng, dp.current_lat, dp.current_lng)
           ELSE 9999 END ASC,
      dp.location_updated_at DESC NULLS LAST
    LIMIT 1;

    IF v_next_driver IS NULL THEN
      v_new_phase := 'waiting';
    END IF;
  END IF;

  IF v_new_phase IN ('offer_a','offer_b') THEN
    UPDATE public.orders SET
      offered_to_driver_id = v_next_driver,
      offer_expires_at = now() + make_interval(secs => v_offer_seconds),
      dispatch_phase = v_new_phase,
      dispatch_started_at = COALESCE(dispatch_started_at, now())
    WHERE id = p_order_id;
  ELSE
    UPDATE public.orders SET
      offered_to_driver_id = NULL,
      offer_expires_at = NULL,
      dispatch_phase = 'waiting',
      dispatch_started_at = COALESCE(dispatch_started_at, now())
    WHERE id = p_order_id;
  END IF;

  RETURN jsonb_build_object(
    'phase', v_new_phase,
    'offered_to', v_next_driver,
    'previous_driver', v_previous_driver
  );
END;
$function$;