
-- 1. Schema additions
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS dispatch_round integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS round_offered_driver_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

-- 2. Dispatch log table
CREATE TABLE IF NOT EXISTS public.order_dispatch_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id uuid,
  round integer NOT NULL DEFAULT 1,
  event text NOT NULL CHECK (event IN ('offered','timeout','rejected','accepted','round_complete','no_drivers')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_dispatch_log_order ON public.order_dispatch_log(order_id, created_at);

GRANT SELECT ON public.order_dispatch_log TO authenticated;
GRANT ALL ON public.order_dispatch_log TO service_role;

ALTER TABLE public.order_dispatch_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dispatch log readable by participants and admins" ON public.order_dispatch_log;
CREATE POLICY "dispatch log readable by participants and admins"
ON public.order_dispatch_log
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR driver_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.orders o
    LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE o.id = order_dispatch_log.order_id
      AND (o.user_id = auth.uid() OR o.customer_id = auth.uid() OR o.driver_id = auth.uid() OR r.owner_user_id = auth.uid())
  )
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.order_dispatch_log;

-- 3. Replace dispatch_assign_next: indefinite cycling with round counter
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

  IF v_order.status <> 'ready' OR v_order.driver_id IS NOT NULL THEN
    RETURN jsonb_build_object('phase', v_order.dispatch_phase, 'reason', 'not_dispatchable');
  END IF;

  v_previous_driver := v_order.offered_to_driver_id;
  v_round := COALESCE(v_order.dispatch_round, 1);
  v_round_ids := COALESCE(v_order.round_offered_driver_ids, ARRAY[]::uuid[]);

  -- Resolve restaurant zone
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

  -- Count eligible online drivers in this zone (ignoring already-tried this round)
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

  -- Pick the next online driver in zone not yet offered THIS round, not currently busy
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

  -- Round exhausted → start a new round
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
    -- Nothing available right now; wait for tick to retry
    UPDATE public.orders SET
      offered_to_driver_id = NULL, offer_expires_at = NULL,
      dispatch_phase = 'waiting',
      dispatch_round = v_round,
      round_offered_driver_ids = v_round_ids,
      dispatch_started_at = COALESCE(dispatch_started_at, now())
    WHERE id = p_order_id;
    INSERT INTO public.order_dispatch_log(order_id, driver_id, round, event)
    VALUES (p_order_id, NULL, v_round, 'no_drivers');
    RETURN jsonb_build_object('phase', 'waiting', 'round', v_round);
  END IF;

  -- Make the offer
  v_round_ids := array_append(v_round_ids, v_next_driver);

  UPDATE public.orders SET
    offered_to_driver_id = v_next_driver,
    offer_expires_at = now() + make_interval(secs => v_offer_seconds),
    dispatch_phase = v_new_phase,
    dispatch_round = v_round,
    round_offered_driver_ids = v_round_ids,
    dispatch_started_at = COALESCE(dispatch_started_at, now())
  WHERE id = p_order_id;

  INSERT INTO public.order_dispatch_log(order_id, driver_id, round, event)
  VALUES (p_order_id, v_next_driver, v_round, 'offered');

  RETURN jsonb_build_object(
    'phase', v_new_phase,
    'offered_to', v_next_driver,
    'previous_driver', v_previous_driver,
    'round', v_round,
    'zone_id', v_restaurant_area_id,
    'zone_name', v_zone_name
  );
END;
$function$;

-- 4. Update dispatch_tick: log timeout for the prior offered driver, drop broadcast-fallback
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
BEGIN
  -- Expire offers
  FOR v_expired IN
    SELECT id, offered_to_driver_id, dispatch_round FROM public.orders
    WHERE offer_expires_at IS NOT NULL
      AND offer_expires_at < now()
      AND status = 'ready'
      AND driver_id IS NULL
      AND offered_to_driver_id IS NOT NULL
  LOOP
    INSERT INTO public.order_dispatch_log(order_id, driver_id, round, event)
    VALUES (v_expired.id, v_expired.offered_to_driver_id, COALESCE(v_expired.dispatch_round, 1), 'timeout');
    PERFORM public.dispatch_assign_next(v_expired.id);
    v_advanced := v_advanced + 1;
    v_advanced_orders := array_append(v_advanced_orders, v_expired.id);
  END LOOP;

  -- Retry "waiting" orders (no driver was available previously)
  FOR v_waiting IN
    SELECT id FROM public.orders
    WHERE status = 'ready'
      AND driver_id IS NULL
      AND dispatch_phase = 'waiting'
  LOOP
    PERFORM public.dispatch_assign_next(v_waiting.id);
    v_retried := v_retried + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'advanced', v_advanced,
    'advanced_orders', v_advanced_orders,
    'retried', v_retried
  );
END;
$function$;

-- 5. driver_decline_offer: log rejection
CREATE OR REPLACE FUNCTION public.driver_decline_offer(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_driver uuid := auth.uid();
  v_round integer;
BEGIN
  IF v_driver IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT dispatch_round INTO v_round
  FROM public.orders
  WHERE id = p_order_id AND offered_to_driver_id = v_driver AND status = 'ready';

  IF v_round IS NULL THEN
    -- Offer already moved on; nothing to do
    RETURN;
  END IF;

  INSERT INTO public.order_dispatch_log(order_id, driver_id, round, event)
  VALUES (p_order_id, v_driver, v_round, 'rejected');

  UPDATE public.orders SET
    offer_expires_at = now() - interval '1 second'
  WHERE id = p_order_id
    AND offered_to_driver_id = v_driver
    AND status = 'ready';

  PERFORM public.dispatch_assign_next(p_order_id);
END;
$function$;

-- 6. driver_accept_offer: log acceptance, clear offer state
CREATE OR REPLACE FUNCTION public.driver_accept_offer(p_order_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_driver uuid := auth.uid();
  v_online boolean;
  v_round integer;
BEGIN
  IF v_driver IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT is_online INTO v_online FROM public.driver_profiles WHERE user_id = v_driver;
  IF NOT COALESCE(v_online, false) THEN
    RAISE EXCEPTION 'You must be online to accept deliveries';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE driver_id = v_driver
      AND status IN ('driver_assigned','picking_up','arrived_at_restaurant','out_for_delivery')
  ) THEN
    RAISE EXCEPTION 'You already have an active delivery';
  END IF;

  UPDATE public.orders SET
    driver_id = v_driver,
    status = 'driver_assigned',
    accepted_at = now(),
    offered_to_driver_id = NULL,
    offer_expires_at = NULL,
    dispatch_phase = NULL
  WHERE id = p_order_id
    AND offered_to_driver_id = v_driver
    AND offer_expires_at > now()
    AND status = 'ready'
    AND driver_id IS NULL
  RETURNING dispatch_round INTO v_round;

  IF FOUND THEN
    INSERT INTO public.order_dispatch_log(order_id, driver_id, round, event)
    VALUES (p_order_id, v_driver, COALESCE(v_round, 1), 'accepted');
    RETURN true;
  END IF;
  RETURN false;
END;
$function$;
