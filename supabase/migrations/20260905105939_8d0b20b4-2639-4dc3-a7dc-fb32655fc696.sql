-- 1. Allow drivers to hold multiple active deliveries -----------------------
CREATE OR REPLACE FUNCTION public.claim_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_driver_id uuid;
BEGIN
  v_driver_id := auth.uid();
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.driver_profiles
    WHERE user_id = v_driver_id
      AND is_online = true
      AND COALESCE(is_suspended, false) = false
  ) THEN
    RAISE EXCEPTION 'Driver must be online to accept orders';
  END IF;

  -- Only guard against re-accepting the SAME order; multiple concurrent
  -- deliveries per driver are allowed.
  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = p_order_id AND driver_id = v_driver_id
  ) THEN
    RAISE EXCEPTION 'You have already accepted this order';
  END IF;

  UPDATE public.orders
  SET driver_id = v_driver_id,
      status = 'driver_assigned',
      accepted_at = now(),
      offered_to_driver_id = NULL,
      offer_expires_at = NULL,
      dispatch_phase = NULL
  WHERE id = p_order_id
    AND status = 'ready'
    AND driver_id IS NULL
    AND dispatch_phase = 'broadcast';

  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.driver_accept_offer(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_driver uuid := auth.uid();
  v_online boolean;
  v_suspended boolean;
  v_round integer;
BEGIN
  IF v_driver IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT is_online, COALESCE(is_suspended, false)
    INTO v_online, v_suspended
  FROM public.driver_profiles WHERE user_id = v_driver;

  IF NOT COALESCE(v_online, false) OR v_suspended THEN
    RAISE EXCEPTION 'You must be online to accept deliveries';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = p_order_id AND driver_id = v_driver
  ) THEN
    RAISE EXCEPTION 'You have already accepted this order';
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

-- 2. Dispatch: stop skipping drivers that already have active deliveries.
--    Only skip a driver while they still have an unanswered offer ringing.
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
      WHERE o2.offered_to_driver_id = dp.user_id
        AND o2.id <> p_order_id
        AND o2.driver_id IS NULL
        AND o2.offer_expires_at > now()
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
        WHERE o2.offered_to_driver_id = dp.user_id
          AND o2.id <> p_order_id
          AND o2.driver_id IS NULL
          AND o2.offer_expires_at > now()
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

-- 3. Admin can assign multiple orders to the same driver (guard duplicates only)
CREATE OR REPLACE FUNCTION public.admin_assign_driver(p_order_id uuid, p_driver_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
  v_current_driver uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT status, driver_id INTO v_status, v_current_driver
  FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_status IN ('delivered','cancelled','rejected') THEN
    RAISE EXCEPTION 'Order is already finalised (%).', v_status;
  END IF;
  IF v_current_driver = p_driver_id THEN
    RAISE EXCEPTION 'This driver is already assigned to this order.';
  END IF;

  UPDATE public.orders
  SET driver_id = p_driver_id,
      status = CASE WHEN status IN ('ready','no_driver_found') THEN 'driver_assigned' ELSE status END,
      accepted_at = COALESCE(accepted_at, now()),
      dispatch_phase = NULL,
      offered_to_driver_id = NULL,
      offer_expires_at = NULL
  WHERE id = p_order_id;

  INSERT INTO public.order_dispatch_log(order_id, driver_id, round, event)
  VALUES (p_order_id, p_driver_id, 1, 'admin_assign');
END;
$function$;

-- 4. Security: drivers may not tamper with privileged profile columns -------
CREATE OR REPLACE FUNCTION public.enforce_driver_profile_update_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
     OR NEW.suspended_reason IS DISTINCT FROM OLD.suspended_reason
     OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
     OR NEW.total_earnings IS DISTINCT FROM OLD.total_earnings
     OR NEW.total_deliveries IS DISTINCT FROM OLD.total_deliveries
     OR NEW.bank_account_holder IS DISTINCT FROM OLD.bank_account_holder
     OR NEW.bank_name IS DISTINCT FROM OLD.bank_name
     OR NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number
     OR NEW.bank_branch_code IS DISTINCT FROM OLD.bank_branch_code
     OR NEW.bank_account_type IS DISTINCT FROM OLD.bank_account_type
  THEN
    RAISE EXCEPTION 'You are not allowed to change these fields.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_driver_profile_update_columns ON public.driver_profiles;
CREATE TRIGGER trg_enforce_driver_profile_update_columns
BEFORE UPDATE ON public.driver_profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_driver_profile_update_columns();