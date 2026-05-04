
-- Update dispatch_assign_next to match drivers by the restaurant's area_id
-- instead of the customer's zone. This ensures orders go to drivers
-- who selected the area the restaurant belongs to.

CREATE OR REPLACE FUNCTION public.dispatch_assign_next(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_next_driver uuid;
  v_previous_driver uuid;
  v_new_phase text;
  v_offer_seconds integer := 180;
  v_restaurant_area_id uuid;
  v_zone_name text;
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

  -- Resolve area from the restaurant instead of customer coords
  IF v_order.restaurant_id IS NOT NULL THEN
    SELECT r.area_id, da.name
    INTO v_restaurant_area_id, v_zone_name
    FROM public.restaurants r
    LEFT JOIN public.delivery_areas da ON da.id = r.area_id
    WHERE r.id = v_order.restaurant_id;
  END IF;

  -- Persist zone name on the order for grouping/UI
  IF v_zone_name IS NOT NULL AND v_order.address_tag IS DISTINCT FROM v_zone_name THEN
    UPDATE public.orders SET address_tag = v_zone_name WHERE id = p_order_id;
  END IF;

  IF v_new_phase IN ('offer_a','offer_b') AND v_restaurant_area_id IS NOT NULL THEN
    SELECT dp.user_id INTO v_next_driver
    FROM public.driver_profiles dp
    JOIN public.driver_service_areas dsa ON dsa.driver_id = dp.user_id AND dsa.area_id = v_restaurant_area_id
    WHERE dp.is_online = true
      AND NOT (dp.user_id = ANY(COALESCE(v_order.missed_by_driver_ids, ARRAY[]::uuid[])))
      AND NOT EXISTS (
        SELECT 1 FROM public.orders o2
        WHERE o2.driver_id = dp.user_id
          AND o2.status IN ('driver_assigned','picking_up','arrived_at_restaurant','out_for_delivery')
      )
    ORDER BY dp.location_updated_at DESC NULLS LAST
    LIMIT 1;

    IF v_next_driver IS NULL THEN
      v_new_phase := 'waiting';
    END IF;
  ELSIF v_new_phase IN ('offer_a','offer_b') THEN
    v_new_phase := 'waiting';
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
    'previous_driver', v_previous_driver,
    'zone_id', v_restaurant_area_id,
    'zone_name', v_zone_name
  );
END;
$$;
