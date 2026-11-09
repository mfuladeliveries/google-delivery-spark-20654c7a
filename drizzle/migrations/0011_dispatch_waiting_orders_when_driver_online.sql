CREATE OR REPLACE FUNCTION public.dispatch_assign_next(p_order_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD; v_next_driver uuid; v_previous_driver uuid;
  v_offer_seconds integer := 60; v_restaurant_area_id uuid; v_zone_name text;
  v_round integer; v_round_ids uuid[]; v_total_drivers integer := 0; v_new_phase text := 'offer_a';
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status NOT IN ('ready','no_driver_found') OR v_order.driver_id IS NOT NULL THEN
    RETURN jsonb_build_object('phase', v_order.dispatch_phase, 'reason', 'not_dispatchable');
  END IF;
  v_previous_driver := v_order.offered_to_driver_id;
  v_round := COALESCE(v_order.dispatch_round, 1);
  v_round_ids := COALESCE(v_order.round_offered_driver_ids, ARRAY[]::uuid[]);

  -- Prefer the area of the actual pickup branch; fall back to the brand area.
  IF v_order.restaurant_location_id IS NOT NULL THEN
    SELECT rl.area_id, da.name INTO v_restaurant_area_id, v_zone_name
    FROM public.restaurant_locations rl LEFT JOIN public.delivery_areas da ON da.id = rl.area_id
    WHERE rl.id = v_order.restaurant_location_id;
  END IF;
  IF v_restaurant_area_id IS NULL AND v_order.restaurant_id IS NOT NULL THEN
    SELECT r.area_id, da.name INTO v_restaurant_area_id, v_zone_name
    FROM public.restaurants r LEFT JOIN public.delivery_areas da ON da.id = r.area_id
    WHERE r.id = v_order.restaurant_id;
  END IF;

  IF v_zone_name IS NOT NULL AND v_order.address_tag IS DISTINCT FROM v_zone_name THEN
    UPDATE public.orders SET address_tag = v_zone_name WHERE id = p_order_id;
  END IF;

  IF v_restaurant_area_id IS NULL THEN
    UPDATE public.orders SET offered_to_driver_id = NULL, offer_expires_at = NULL,
      dispatch_phase = 'waiting', dispatch_started_at = COALESCE(dispatch_started_at, now())
    WHERE id = p_order_id;
    INSERT INTO public.order_dispatch_log(order_id, driver_id, round, event) VALUES (p_order_id, NULL, v_round, 'no_drivers');
    RETURN jsonb_build_object('phase', 'waiting', 'reason', 'no_zone');
  END IF;

  SELECT count(DISTINCT dp.user_id) INTO v_total_drivers
  FROM public.driver_profiles dp
  JOIN public.driver_service_areas dsa ON dsa.driver_id = dp.user_id AND dsa.area_id = v_restaurant_area_id
  WHERE dp.is_online = true AND COALESCE(dp.is_suspended, false) = false;

  IF v_total_drivers = 0 THEN
    UPDATE public.orders SET offered_to_driver_id = NULL, offer_expires_at = NULL,
      dispatch_phase = 'waiting', dispatch_started_at = COALESCE(dispatch_started_at, now())
    WHERE id = p_order_id;
    INSERT INTO public.order_dispatch_log(order_id, driver_id, round, event) VALUES (p_order_id, NULL, v_round, 'no_drivers');
    RETURN jsonb_build_object('phase', 'waiting', 'reason', 'no_drivers_online', 'round', v_round);
  END IF;

  SELECT dp.user_id INTO v_next_driver
  FROM public.driver_profiles dp
  JOIN public.driver_service_areas dsa ON dsa.driver_id = dp.user_id AND dsa.area_id = v_restaurant_area_id
  WHERE dp.is_online = true AND COALESCE(dp.is_suspended, false) = false
    AND NOT (dp.user_id = ANY(v_round_ids))
    AND NOT EXISTS (SELECT 1 FROM public.orders o2 WHERE o2.offered_to_driver_id = dp.user_id
      AND o2.id <> p_order_id AND o2.driver_id IS NULL AND o2.offer_expires_at > now())
  ORDER BY dp.location_updated_at DESC NULLS LAST LIMIT 1;

  IF v_next_driver IS NULL THEN
    INSERT INTO public.order_dispatch_log(order_id, driver_id, round, event) VALUES (p_order_id, NULL, v_round, 'round_complete');
    v_round := v_round + 1; v_round_ids := ARRAY[]::uuid[];
    SELECT dp.user_id INTO v_next_driver
    FROM public.driver_profiles dp
    JOIN public.driver_service_areas dsa ON dsa.driver_id = dp.user_id AND dsa.area_id = v_restaurant_area_id
    WHERE dp.is_online = true AND COALESCE(dp.is_suspended, false) = false
      AND NOT EXISTS (SELECT 1 FROM public.orders o2 WHERE o2.offered_to_driver_id = dp.user_id
        AND o2.id <> p_order_id AND o2.driver_id IS NULL AND o2.offer_expires_at > now())
    ORDER BY dp.location_updated_at DESC NULLS LAST LIMIT 1;
  END IF;

  IF v_next_driver IS NULL THEN
    UPDATE public.orders SET offered_to_driver_id = NULL, offer_expires_at = NULL,
      dispatch_phase = 'waiting', dispatch_started_at = COALESCE(dispatch_started_at, now()),
      dispatch_round = v_round, round_offered_driver_ids = v_round_ids
    WHERE id = p_order_id;
    INSERT INTO public.order_dispatch_log(order_id, driver_id, round, event) VALUES (p_order_id, NULL, v_round, 'no_drivers');
    RETURN jsonb_build_object('phase','waiting','reason','exhausted','round', v_round);
  END IF;

  IF v_order.dispatch_phase = 'offer_a' THEN v_new_phase := 'offer_b'; ELSE v_new_phase := 'offer_a'; END IF;
  v_round_ids := array_append(v_round_ids, v_next_driver);

  UPDATE public.orders SET offered_to_driver_id = v_next_driver,
    offer_expires_at = now() + (v_offer_seconds || ' seconds')::interval,
    dispatch_phase = v_new_phase, dispatch_started_at = COALESCE(dispatch_started_at, now()),
    dispatch_round = v_round, round_offered_driver_ids = v_round_ids
  WHERE id = p_order_id;
  INSERT INTO public.order_dispatch_log(order_id, driver_id, round, event) VALUES (p_order_id, v_next_driver, v_round, 'offer');

  RETURN jsonb_build_object('phase', v_new_phase, 'offered_to', v_next_driver,
    'expires_in_seconds', v_offer_seconds, 'round', v_round, 'previous_driver', v_previous_driver);
END;
$function$;

-- Server-side: when a driver goes online, immediately offer waiting orders.
CREATE OR REPLACE FUNCTION public.dispatch_on_driver_online()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_online = true AND COALESCE(OLD.is_online, false) = false
     AND COALESCE(NEW.is_suspended, false) = false THEN
    BEGIN
      PERFORM public.dispatch_tick();
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'dispatch_on_driver_online failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.dispatch_on_driver_online() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_dispatch_on_driver_online ON public.driver_profiles;
CREATE TRIGGER trg_dispatch_on_driver_online
AFTER UPDATE OF is_online ON public.driver_profiles
FOR EACH ROW EXECUTE FUNCTION public.dispatch_on_driver_online();