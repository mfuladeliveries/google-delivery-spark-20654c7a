-- 1. Add coordinates to restaurants
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

-- 2. Replace dispatch_assign_next with haversine-aware ranking
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
  v_offer_seconds integer := 20;
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

  -- Mark previous offeree as missed
  IF v_previous_driver IS NOT NULL THEN
    UPDATE public.orders
    SET missed_by_driver_ids = array_append(COALESCE(missed_by_driver_ids, ARRAY[]::uuid[]), v_previous_driver)
    WHERE id = p_order_id
      AND NOT (v_previous_driver = ANY(COALESCE(missed_by_driver_ids, ARRAY[]::uuid[])));
    v_order.missed_by_driver_ids := array_append(COALESCE(v_order.missed_by_driver_ids, ARRAY[]::uuid[]), v_previous_driver);
  END IF;

  -- Determine next phase
  IF v_order.dispatch_phase IS NULL THEN
    v_new_phase := 'offer_a';
  ELSIF v_order.dispatch_phase = 'offer_a' THEN
    v_new_phase := 'offer_b';
  ELSE
    v_new_phase := 'waiting';
  END IF;

  -- Look up restaurant coordinates (if any)
  IF v_order.restaurant_id IS NOT NULL THEN
    SELECT lat, lng INTO v_rest_lat, v_rest_lng
    FROM public.restaurants WHERE id = v_order.restaurant_id;
  END IF;

  -- Pick next driver
  IF v_new_phase IN ('offer_a', 'offer_b') THEN
    IF v_rest_lat IS NOT NULL AND v_rest_lng IS NOT NULL THEN
      -- Haversine ranking with 10km cap
      SELECT dp.user_id INTO v_next_driver
      FROM public.driver_profiles dp
      WHERE dp.is_online = true
        AND dp.current_lat IS NOT NULL
        AND dp.current_lng IS NOT NULL
        AND NOT (dp.user_id = ANY(COALESCE(v_order.missed_by_driver_ids, ARRAY[]::uuid[])))
        AND NOT EXISTS (
          SELECT 1 FROM public.orders o2
          WHERE o2.driver_id = dp.user_id
            AND o2.status IN ('driver_assigned','picking_up','arrived_at_restaurant','out_for_delivery')
        )
        AND (
          6371 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(v_rest_lat)) * cos(radians(dp.current_lat))
              * cos(radians(dp.current_lng) - radians(v_rest_lng))
              + sin(radians(v_rest_lat)) * sin(radians(dp.current_lat))
            ))
          )
        ) <= v_max_km
      ORDER BY (
        6371 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians(v_rest_lat)) * cos(radians(dp.current_lat))
            * cos(radians(dp.current_lng) - radians(v_rest_lng))
            + sin(radians(v_rest_lat)) * sin(radians(dp.current_lat))
          ))
        )
      ) ASC, dp.location_updated_at DESC NULLS LAST
      LIMIT 1;
    ELSE
      -- Fallback: recency
      SELECT dp.user_id INTO v_next_driver
      FROM public.driver_profiles dp
      WHERE dp.is_online = true
        AND NOT (dp.user_id = ANY(COALESCE(v_order.missed_by_driver_ids, ARRAY[]::uuid[])))
        AND NOT EXISTS (
          SELECT 1 FROM public.orders o2
          WHERE o2.driver_id = dp.user_id
            AND o2.status IN ('driver_assigned','picking_up','arrived_at_restaurant','out_for_delivery')
        )
      ORDER BY dp.location_updated_at DESC NULLS LAST, dp.updated_at DESC
      LIMIT 1;
    END IF;

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