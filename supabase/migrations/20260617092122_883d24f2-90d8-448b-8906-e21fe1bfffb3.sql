-- 1) Allow dispatch_assign_next to also work on no_driver_found orders
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
  v_offer_seconds integer := 60;
  v_restaurant_area_id uuid;
  v_zone_name text;
  v_round integer;
  v_round_ids uuid[];
  v_total_drivers integer := 0;
  v_new_phase text := 'offer_a';
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status NOT IN ('ready','no_driver_found') OR v_order.driver_id IS NOT NULL THEN
    RETURN jsonb_build_object('phase', v_order.dispatch_phase, 'reason', 'not_dispatchable');
  END IF;

  v_previous_driver := v_order.offered_to_driver_id;
  v_round := COALESCE(v_order.dispatch_round, 1);
  v_round_ids := COALESCE(v_order.round_offered_driver_ids, ARRAY[]::uuid[]);

  IF v_order.restaurant_id IS NOT NULL THEN
    SELECT r.area_id, da.name
    INTO v_restaurant_area_id, v_zone_name
    FROM public.restaurants r
    LEFT JOIN public.delivery_areas da ON da.id = r.area_id
    WHERE r.id = v_order.restaurant_id;
  END IF;

  IF v_zone_name IS NOT NULL AND v_order.address_tag IS DISTINCT FROM v_zone_name THEN
    UPDATE public.orders SET address_tag = v_zone_name WHERE id = p_order_id;
  END IF;

  IF v_restaurant_area_id IS NULL THEN
    UPDATE public.orders SET
      offered_to_driver_id = NULL, offer_expires_at = NULL,
      dispatch_phase = 'waiting',
      dispatch_started_at = COALESCE(dispatch_started_at, now())
    WHERE id = p_order_id;
    INSERT INTO public.order_dispatch_log(order_id, driver_id, round, event)
    VALUES (p_order_id, NULL, v_round, 'no_drivers');
    RETURN jsonb_build_object('phase', 'waiting', 'reason', 'no_zone');
  END IF;

  SELECT count(DISTINCT dp.user_id) INTO v_total_drivers
  FROM public.driver_profiles dp
  JOIN public.driver_service_areas dsa ON dsa.driver_id = dp.user_id AND dsa.area_id = v_restaurant_area_id
  WHERE dp.is_online = true
    AND COALESCE(dp.is_suspended, false) = false;

  IF v_total_drivers = 0 THEN
    UPDATE public.orders SET
      offered_to_driver_id = NULL, offer_expires_at = NULL,
      dispatch_phase = 'waiting',
      dispatch_started_at = COALESCE(dispatch_started_at, now())
    WHERE id = p_order_id;
    INSERT INTO public.order_dispatch_log(order_id, driver_id, round, event)
    VALUES (p_order_id, NULL, v_round, 'no_drivers');
    RETURN jsonb_build_object('phase', 'waiting', 'reason', 'no_drivers_online', 'round', v_round);
  END IF;

  SELECT dp.user_id INTO v_next_driver
  FROM public.driver_profiles dp
  JOIN public.driver_service_areas dsa ON dsa.driver_id = dp.user_id AND dsa.area_id = v_restaurant_area_id
  WHERE dp.is_online = true
    AND COALESCE(dp.is_suspended, false) = false
    AND NOT (dp.user_id = ANY(v_round_ids))
    AND NOT EXISTS (
      SELECT 1 FROM public.orders o2
      WHERE o2.driver_id = dp.user_id
        AND o2.status IN ('driver_assigned','picking_up','arrived_at_restaurant','out_for_delivery')
    )
  ORDER BY dp.location_updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_next_driver IS NULL THEN
    INSERT INTO public.order_dispatch_log(order_id, driver_id, round, event)
    VALUES (p_order_id, NULL, v_round, 'round_complete');

    v_round := v_round + 1;
    v_round_ids := ARRAY[]::uuid[];

    SELECT dp.user_id INTO v_next_driver
    FROM public.driver_profiles dp
    JOIN public.driver_service_areas dsa ON dsa.driver_id = dp.user_id AND dsa.area_id = v_restaurant_area_id
    WHERE dp.is_online = true
      AND COALESCE(dp.is_suspended, false) = false
      AND NOT EXISTS (
        SELECT 1 FROM public.orders o2
        WHERE o2.driver_id = dp.user_id
          AND o2.status IN ('driver_assigned','picking_up','arrived_at_restaurant','out_for_delivery')
      )
    ORDER BY dp.location_updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_next_driver IS NULL THEN
    UPDATE public.orders SET
      offered_to_driver_id = NULL, offer_expires_at = NULL,
      dispatch_phase = 'waiting',
      dispatch_started_at = COALESCE(dispatch_started_at, now()),
      dispatch_round = v_round,
      round_offered_driver_ids = v_round_ids
    WHERE id = p_order_id;
    INSERT INTO public.order_dispatch_log(order_id, driver_id, round, event)
    VALUES (p_order_id, NULL, v_round, 'no_drivers');
    RETURN jsonb_build_object('phase','waiting','reason','exhausted','round', v_round);
  END IF;

  IF v_order.dispatch_phase = 'offer_a' THEN
    v_new_phase := 'offer_b';
  ELSE
    v_new_phase := 'offer_a';
  END IF;

  v_round_ids := array_append(v_round_ids, v_next_driver);

  UPDATE public.orders SET
    offered_to_driver_id = v_next_driver,
    offer_expires_at = now() + (v_offer_seconds || ' seconds')::interval,
    dispatch_phase = v_new_phase,
    dispatch_started_at = COALESCE(dispatch_started_at, now()),
    dispatch_round = v_round,
    round_offered_driver_ids = v_round_ids
  WHERE id = p_order_id;

  INSERT INTO public.order_dispatch_log(order_id, driver_id, round, event)
  VALUES (p_order_id, v_next_driver, v_round, 'offer');

  RETURN jsonb_build_object(
    'phase', v_new_phase,
    'offered_to', v_next_driver,
    'expires_in_seconds', v_offer_seconds,
    'round', v_round,
    'previous_driver', v_previous_driver
  );
END;
$function$;

-- 2) dispatch_tick also retries no_driver_found orders every tick
CREATE OR REPLACE FUNCTION public.dispatch_tick()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_expired RECORD;
  v_advanced integer := 0;
  v_advanced_orders uuid[] := ARRAY[]::uuid[];
  v_waiting RECORD;
  v_retried integer := 0;
  v_ndf RECORD;
  v_ndf_retried integer := 0;
BEGIN
  FOR v_expired IN
    SELECT id, offered_to_driver_id, dispatch_round FROM public.orders
    WHERE offer_expires_at IS NOT NULL
      AND offer_expires_at < now()
      AND status IN ('ready','no_driver_found')
      AND driver_id IS NULL
      AND offered_to_driver_id IS NOT NULL
  LOOP
    INSERT INTO public.order_dispatch_log(order_id, driver_id, round, event)
    VALUES (v_expired.id, v_expired.offered_to_driver_id, COALESCE(v_expired.dispatch_round, 1), 'timeout');
    PERFORM public.dispatch_assign_next(v_expired.id);
    v_advanced := v_advanced + 1;
    v_advanced_orders := array_append(v_advanced_orders, v_expired.id);
  END LOOP;

  FOR v_waiting IN
    SELECT id FROM public.orders
    WHERE status = 'ready'
      AND driver_id IS NULL
      AND dispatch_phase = 'waiting'
  LOOP
    PERFORM public.dispatch_assign_next(v_waiting.id);
    v_retried := v_retried + 1;
  END LOOP;

  -- Keep retrying no_driver_found orders every tick so newly-online drivers can be offered
  FOR v_ndf IN
    SELECT id FROM public.orders
    WHERE status = 'no_driver_found'
      AND driver_id IS NULL
      AND (offered_to_driver_id IS NULL OR COALESCE(offer_expires_at, now()) <= now())
  LOOP
    PERFORM public.dispatch_assign_next(v_ndf.id);
    v_ndf_retried := v_ndf_retried + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'advanced', v_advanced,
    'advanced_orders', v_advanced_orders,
    'retried', v_retried,
    'ndf_retried', v_ndf_retried
  );
END;
$function$;

-- 3) admin_cancel_order: auto-flag refund when cancelling a paid-online no_driver_found order
--    and support manual driver assignment via a new RPC
CREATE OR REPLACE FUNCTION public.admin_cancel_order(p_order_id uuid, p_reason text DEFAULT 'Cancelled by admin'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current text;
  v_payment text;
  v_refund text;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT status, payment_method, refund_status
  INTO v_current, v_payment, v_refund
  FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_current IN ('delivered','cancelled','rejected') THEN
    RAISE EXCEPTION 'Order is already finalised (%).', v_current;
  END IF;

  UPDATE public.orders
  SET status = 'cancelled',
      driver_id = NULL,
      cancelled_at = now(),
      cancel_reason = COALESCE(p_reason, 'Cancelled by admin'),
      offered_to_driver_id = NULL,
      offer_expires_at = NULL,
      dispatch_phase = NULL,
      refund_status = CASE
        WHEN v_current = 'no_driver_found'
             AND v_payment = 'online'
             AND v_refund IS NULL
          THEN 'pending'
        ELSE refund_status
      END
  WHERE id = p_order_id;
END;
$function$;

-- 4) Admin manually assigns a driver to a no_driver_found (or other dispatchable) order
CREATE OR REPLACE FUNCTION public.admin_assign_driver(p_order_id uuid, p_driver_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT status INTO v_status FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_status IN ('delivered','cancelled','rejected') THEN
    RAISE EXCEPTION 'Order is already finalised (%).', v_status;
  END IF;

  UPDATE public.orders
  SET driver_id = p_driver_id,
      status = 'driver_assigned',
      dispatch_phase = NULL,
      offered_to_driver_id = NULL,
      offer_expires_at = NULL
  WHERE id = p_order_id;

  INSERT INTO public.order_dispatch_log(order_id, driver_id, round, event)
  VALUES (p_order_id, p_driver_id, 1, 'admin_assign');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_assign_driver(uuid, uuid) TO authenticated;