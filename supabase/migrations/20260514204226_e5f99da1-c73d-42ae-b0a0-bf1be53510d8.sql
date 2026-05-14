
-- 1. Add approval_mode + timeout to restaurants. Keep requires_confirmation as the canonical flag for backwards compat.
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS approval_mode text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS confirmation_timeout_minutes integer NOT NULL DEFAULT 15;

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_approval_mode_check;
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_approval_mode_check
  CHECK (approval_mode IN ('auto','restaurant','admin'));

-- Sync legacy flag → new mode
UPDATE public.restaurants
   SET approval_mode = 'restaurant'
 WHERE requires_confirmation = true AND approval_mode = 'auto';

-- 2. Allow restaurant owners to also set status to pending_payment / awaiting_restaurant when accepting
DROP POLICY IF EXISTS "Restaurant owners can update order status" ON public.orders;
CREATE POLICY "Restaurant owners can update order status"
ON public.orders
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = orders.restaurant_id AND r.owner_user_id = auth.uid()))
WITH CHECK (status IN ('confirmed','preparing','ready','rejected','pending_payment','awaiting_restaurant'));

-- Allow restaurants to also see their awaiting_restaurant orders (currently they're blocked because status='pending_payment' was the only excluded case, but awaiting_restaurant is fine to show — let's make it explicit)
DROP POLICY IF EXISTS "Restaurant owners can view their orders" ON public.orders;
CREATE POLICY "Restaurant owners can view their orders"
ON public.orders
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = orders.restaurant_id AND r.owner_user_id = auth.uid())
  AND status <> 'pending_payment'
);

-- 3. create_verified_order: branch on approval_mode
CREATE OR REPLACE FUNCTION public.create_verified_order(
  p_items jsonb, p_restaurant_name text, p_customer_name text, p_customer_contact text,
  p_customer_address text, p_customer_lat double precision, p_customer_lng double precision,
  p_special_notes text DEFAULT ''::text, p_tip numeric DEFAULT 0,
  p_delivery_code text DEFAULT '0000'::text, p_payment_method text DEFAULT 'online'::text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_subtotal numeric := 0;
  v_tax numeric;
  v_delivery_fee numeric;
  v_zone jsonb;
  v_zone_name text;
  v_zone_id uuid;
  v_total numeric;
  v_item record;
  v_verified_items jsonb := '[]'::jsonb;
  v_restaurant_id uuid;
  v_restaurant_open boolean;
  v_rest_lat double precision;
  v_rest_lng double precision;
  v_approval_mode text;
  v_order_number integer;
  v_order_id uuid;
  v_user_id uuid;
  v_drivers_in_zone integer := 0;
  v_init_status text;
  v_payment_initiated timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT public.check_rate_limit(v_user_id::text, 'create_order', 5, 60) THEN
    RAISE EXCEPTION 'Too many orders in a short time. Please wait a minute and try again.' USING ERRCODE = '42901';
  END IF;

  IF p_customer_lat IS NULL OR p_customer_lng IS NULL OR p_customer_lat = 0 OR p_customer_lng = 0
     OR p_customer_lat < -90 OR p_customer_lat > 90 OR p_customer_lng < -180 OR p_customer_lng > 180 THEN
    PERFORM public.log_invalid_order_attempt(p_restaurant_name, 'invalid_coords', p_customer_lat, p_customer_lng, NULL);
    RAISE EXCEPTION 'Invalid delivery coordinates. Please pick your address on the map.' USING ERRCODE = '22023';
  END IF;

  IF p_tip < 0 OR p_tip > 10000 THEN RAISE EXCEPTION 'Invalid tip amount'; END IF;
  IF p_payment_method <> 'online' THEN RAISE EXCEPTION 'Only online payment is supported'; END IF;

  SELECT id, is_open, lat, lng, COALESCE(approval_mode,'auto')
    INTO v_restaurant_id, v_restaurant_open, v_rest_lat, v_rest_lng, v_approval_mode
  FROM restaurants WHERE name = p_restaurant_name AND is_active = true LIMIT 1;

  IF v_restaurant_id IS NULL THEN RAISE EXCEPTION 'Restaurant not found or inactive'; END IF;
  IF NOT COALESCE(v_restaurant_open, false) THEN
    RAISE EXCEPTION 'Restaurant is currently closed. Please try again later.' USING ERRCODE = '22023';
  END IF;

  v_zone := public.find_nearest_zone(p_customer_lat, p_customer_lng, v_rest_lat, v_rest_lng);
  IF NOT (v_zone->>'found')::boolean THEN
    PERFORM public.log_invalid_order_attempt(p_restaurant_name, 'outside_service_area', p_customer_lat, p_customer_lng, NULL);
    RAISE EXCEPTION 'Delivery is not available in your area yet.' USING ERRCODE = '22023';
  END IF;
  v_delivery_fee := (v_zone->>'delivery_fee')::numeric;
  v_zone_name    := v_zone->>'zone_name';
  v_zone_id      := (v_zone->>'zone_id')::uuid;

  SELECT count(DISTINCT dp.user_id) INTO v_drivers_in_zone
  FROM public.driver_profiles dp
  JOIN public.driver_service_areas dsa ON dsa.driver_id = dp.user_id
  WHERE dp.is_online = true AND dsa.area_id = v_zone_id;

  IF v_drivers_in_zone = 0 THEN
    PERFORM public.log_invalid_order_attempt(p_restaurant_name, 'no_driver_online', p_customer_lat, p_customer_lng, NULL);
    RAISE EXCEPTION 'No drivers are online in your area right now. Please try again shortly.' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN
    SELECT mi.id, mi.name, mi.price, mi.category, (elem->>'quantity')::integer AS quantity
    FROM jsonb_array_elements(p_items) AS elem
    JOIN menu_items mi ON mi.id = (elem->>'id')::uuid
    WHERE mi.is_available = true
  LOOP
    v_subtotal := v_subtotal + (v_item.price * v_item.quantity);
    v_verified_items := v_verified_items || jsonb_build_object(
      'id', v_item.id, 'name', v_item.name, 'category', v_item.category,
      'price', v_item.price, 'quantity', v_item.quantity);
  END LOOP;

  IF v_subtotal = 0 THEN RAISE EXCEPTION 'No valid items in order'; END IF;

  v_tax := ROUND(v_subtotal * 0.05, 2);
  v_total := v_subtotal + v_tax + v_delivery_fee + p_tip;

  IF v_approval_mode IN ('restaurant','admin') THEN
    v_init_status := 'awaiting_restaurant';
    v_payment_initiated := NULL;
  ELSE
    v_init_status := 'pending_payment';
    v_payment_initiated := now();
  END IF;

  INSERT INTO orders (
    user_id, customer_id, restaurant_id, restaurant,
    items, subtotal, tax, delivery_fee, tip, total,
    customer_name, customer_contact, customer_address,
    customer_lat, customer_lng,
    special_notes, delivery_code, admin_delivery_code,
    status, payment_status, payment_method, payment_provider,
    payment_initiated_at, address_tag
  ) VALUES (
    v_user_id, v_user_id, v_restaurant_id, p_restaurant_name,
    v_verified_items, v_subtotal, v_tax, v_delivery_fee, p_tip, v_total,
    p_customer_name, p_customer_contact, p_customer_address,
    p_customer_lat, p_customer_lng,
    p_special_notes, p_delivery_code, p_delivery_code,
    v_init_status, 'pending', 'online', 'payfast',
    v_payment_initiated, v_zone_name
  )
  RETURNING id, order_number INTO v_order_id, v_order_number;

  RETURN jsonb_build_object(
    'order_id', v_order_id, 'order_number', v_order_number,
    'subtotal', v_subtotal, 'tax', v_tax, 'delivery_fee', v_delivery_fee,
    'tip', p_tip, 'total', v_total, 'payment_method', 'online',
    'zone_name', v_zone_name, 'address_tag', v_zone_name,
    'pricing_distance_km', (v_zone->>'pricing_distance_km')::numeric,
    'status', v_init_status,
    'approval_mode', v_approval_mode
  );
END;
$function$;

-- 4. New RPC: restaurant or admin decides on awaiting_restaurant order
CREATE OR REPLACE FUNCTION public.restaurant_decide_availability(
  p_order_id uuid, p_accept boolean, p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_mode text;
  v_is_owner boolean := false;
  v_is_admin boolean := has_role(auth.uid(), 'admin'::app_role);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT o.*, COALESCE(r.approval_mode,'auto') AS approval_mode,
         (r.owner_user_id = auth.uid()) AS is_owner
    INTO v_order
  FROM public.orders o
  JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE o.id = p_order_id
  FOR UPDATE OF o;

  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  v_mode := v_order.approval_mode;
  v_is_owner := v_order.is_owner;

  IF v_order.status <> 'awaiting_restaurant' THEN
    RAISE EXCEPTION 'Order is not awaiting confirmation (current: %)', v_order.status;
  END IF;

  -- Authorisation: admin mode requires admin; restaurant mode allows owner or admin
  IF v_mode = 'admin' AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Only an admin can decide on this order';
  END IF;
  IF v_mode <> 'admin' AND NOT (v_is_owner OR v_is_admin) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  IF p_accept THEN
    UPDATE public.orders SET
      status = 'pending_payment',
      payment_initiated_at = now()
    WHERE id = p_order_id;
  ELSE
    UPDATE public.orders SET
      status = 'rejected',
      cancelled_at = now(),
      cancel_reason = COALESCE(p_reason, 'Restaurant unable to fulfil order')
    WHERE id = p_order_id;
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'restaurant', v_order.restaurant,
    'total', v_order.total,
    'user_id', v_order.user_id,
    'accepted', p_accept,
    'new_status', CASE WHEN p_accept THEN 'pending_payment' ELSE 'rejected' END
  );
END;
$function$;

-- 5. Auto-cancel awaiting_restaurant orders past per-restaurant timeout
CREATE OR REPLACE FUNCTION public.auto_cancel_stale_awaiting_orders()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.orders o
    SET status = 'cancelled',
        cancelled_at = now(),
        cancel_reason = 'Restaurant did not confirm in time'
    FROM public.restaurants r
    WHERE r.id = o.restaurant_id
      AND o.status = 'awaiting_restaurant'
      AND o.created_at < now() - make_interval(mins => COALESCE(r.confirmation_timeout_minutes, 15))
    RETURNING o.id
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$function$;

-- 6. Extend the global 12h cleanup to also catch awaiting_restaurant
CREATE OR REPLACE FUNCTION public.auto_cancel_stale_orders()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.orders
    SET status = 'cancelled',
        driver_id = NULL,
        cancelled_at = COALESCE(cancelled_at, now()),
        cancel_reason = COALESCE(cancel_reason, 'Auto-cancelled: not completed within 12 hours')
    WHERE status IN (
      'awaiting_restaurant','pending','confirmed','preparing','ready',
      'driver_assigned','picking_up','arrived_at_restaurant','out_for_delivery'
    )
      AND created_at < (now() - interval '12 hours')
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$function$;
