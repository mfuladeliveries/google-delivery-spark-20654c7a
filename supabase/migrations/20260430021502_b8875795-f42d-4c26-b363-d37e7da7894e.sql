
-- 1. Add address_tag column
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS address_tag text;
CREATE INDEX IF NOT EXISTS idx_orders_address_tag ON public.orders(address_tag) WHERE address_tag IS NOT NULL;

-- 2. Helper: derive an address_tag from a free-text address by matching delivery_areas
CREATE OR REPLACE FUNCTION public.derive_address_tag(p_address text)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tag text;
BEGIN
  IF p_address IS NULL OR length(trim(p_address)) = 0 THEN
    RETURN NULL;
  END IF;

  -- Prefer match by name; fall back to suburb. Longest match wins to avoid
  -- a short generic name swallowing a more specific area.
  SELECT da.name INTO v_tag
  FROM public.delivery_areas da
  WHERE da.is_active = true
    AND (
      position(lower(da.name) IN lower(p_address)) > 0
      OR (da.suburb <> '' AND position(lower(da.suburb) IN lower(p_address)) > 0)
    )
  ORDER BY
    CASE WHEN position(lower(da.name) IN lower(p_address)) > 0 THEN 0 ELSE 1 END,
    length(da.name) DESC
  LIMIT 1;

  RETURN v_tag;
END;
$$;

-- 3. Backfill existing orders that don't yet have an address_tag
UPDATE public.orders
SET address_tag = public.derive_address_tag(customer_address)
WHERE address_tag IS NULL
  AND customer_address IS NOT NULL
  AND status IN ('pending','confirmed','preparing','ready','driver_assigned','picking_up','arrived_at_restaurant','out_for_delivery');

-- 4. Update create_verified_order to populate address_tag
CREATE OR REPLACE FUNCTION public.create_verified_order(p_items jsonb, p_restaurant_name text, p_customer_name text, p_customer_contact text, p_customer_address text, p_customer_lat double precision, p_customer_lng double precision, p_special_notes text DEFAULT ''::text, p_tip numeric DEFAULT 0, p_delivery_code text DEFAULT '0000'::text, p_payment_method text DEFAULT 'cash'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_subtotal numeric := 0;
  v_tax numeric;
  v_delivery_fee numeric;
  v_service jsonb;
  v_total numeric;
  v_item record;
  v_verified_items jsonb := '[]'::jsonb;
  v_restaurant_id uuid;
  v_restaurant_open boolean;
  v_restaurant_lat double precision;
  v_restaurant_lng double precision;
  v_distance double precision;
  v_max_km double precision := 8;
  v_order_number integer;
  v_order_id uuid;
  v_user_id uuid;
  v_address_tag text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.check_rate_limit(v_user_id::text, 'create_order', 5, 60) THEN
    RAISE EXCEPTION 'Too many orders in a short time. Please wait a minute and try again.'
      USING ERRCODE = '42901';
  END IF;

  IF p_customer_lat IS NULL OR p_customer_lng IS NULL
     OR p_customer_lat = 0 OR p_customer_lng = 0
     OR p_customer_lat < -90 OR p_customer_lat > 90
     OR p_customer_lng < -180 OR p_customer_lng > 180 THEN
    PERFORM public.log_invalid_order_attempt(p_restaurant_name, 'invalid_coords', p_customer_lat, p_customer_lng, NULL);
    RAISE EXCEPTION 'Invalid delivery coordinates. Please pick your address on the map.'
      USING ERRCODE = '22023';
  END IF;

  IF p_tip < 0 OR p_tip > 10000 THEN
    RAISE EXCEPTION 'Invalid tip amount';
  END IF;

  IF p_payment_method NOT IN ('cash', 'online') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  v_service := public.check_service_area(p_customer_lat, p_customer_lng);
  IF NOT (v_service->>'in_range')::boolean THEN
    PERFORM public.log_invalid_order_attempt(p_restaurant_name, 'outside_service_area', p_customer_lat, p_customer_lng, (v_service->>'distance_km')::double precision);
    RAISE EXCEPTION 'Delivery not available in your area.'
      USING ERRCODE = '22023';
  END IF;
  v_delivery_fee := (v_service->>'fee')::numeric;

  SELECT id, is_open, lat, lng
    INTO v_restaurant_id, v_restaurant_open, v_restaurant_lat, v_restaurant_lng
  FROM restaurants
  WHERE name = p_restaurant_name AND is_active = true
  LIMIT 1;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant not found or inactive';
  END IF;

  IF NOT COALESCE(v_restaurant_open, false) THEN
    RAISE EXCEPTION 'Restaurant is currently closed. Please try again later.'
      USING ERRCODE = '22023';
  END IF;

  IF v_restaurant_lat IS NOT NULL AND v_restaurant_lng IS NOT NULL THEN
    v_distance := public.distance_km(v_restaurant_lat, v_restaurant_lng, p_customer_lat, p_customer_lng);
    IF v_distance > v_max_km THEN
      PERFORM public.log_invalid_order_attempt(p_restaurant_name, 'too_far_from_restaurant', p_customer_lat, p_customer_lng, v_distance);
      RAISE EXCEPTION 'Your address is outside the % km delivery range for this restaurant.', v_max_km
        USING ERRCODE = '22023';
    END IF;
  END IF;

  FOR v_item IN
    SELECT
      mi.id, mi.name, mi.price, mi.category,
      (elem->>'quantity')::integer AS quantity
    FROM jsonb_array_elements(p_items) AS elem
    JOIN menu_items mi ON mi.id = (elem->>'id')::uuid
    WHERE mi.is_available = true
  LOOP
    v_subtotal := v_subtotal + (v_item.price * v_item.quantity);
    v_verified_items := v_verified_items || jsonb_build_object(
      'id', v_item.id,
      'name', v_item.name,
      'category', v_item.category,
      'price', v_item.price,
      'quantity', v_item.quantity
    );
  END LOOP;

  IF v_subtotal = 0 THEN
    RAISE EXCEPTION 'No valid items in order';
  END IF;

  v_tax := ROUND(v_subtotal * 0.05, 2);
  v_total := v_subtotal + v_tax + v_delivery_fee + p_tip;

  v_address_tag := public.derive_address_tag(p_customer_address);

  INSERT INTO orders (
    user_id, customer_id, restaurant_id, restaurant,
    items, subtotal, tax, delivery_fee, tip, total,
    customer_name, customer_contact, customer_address,
    customer_lat, customer_lng,
    special_notes, delivery_code, admin_delivery_code,
    status, payment_status, payment_method, address_tag
  ) VALUES (
    v_user_id, v_user_id, v_restaurant_id, p_restaurant_name,
    v_verified_items, v_subtotal, v_tax, v_delivery_fee, p_tip, v_total,
    p_customer_name, p_customer_contact, p_customer_address,
    p_customer_lat, p_customer_lng,
    p_special_notes, p_delivery_code, p_delivery_code,
    'ready', 'pending', p_payment_method, v_address_tag
  )
  RETURNING id, order_number INTO v_order_id, v_order_number;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'tax', v_tax,
    'delivery_fee', v_delivery_fee,
    'tip', p_tip,
    'total', v_total,
    'payment_method', p_payment_method,
    'address_tag', v_address_tag
  );
END;
$function$;

-- 5. Update dispatch_assign_next to match by address_tag (exact)
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
  v_tag text;
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

  -- Resolve tag: prefer stored address_tag, fall back to deriving from address
  -- so legacy orders without the column populated still dispatch correctly.
  v_tag := v_order.address_tag;
  IF v_tag IS NULL THEN
    v_tag := public.derive_address_tag(v_order.customer_address);
    IF v_tag IS NOT NULL THEN
      UPDATE public.orders SET address_tag = v_tag WHERE id = p_order_id;
    END IF;
  END IF;

  IF v_new_phase IN ('offer_a', 'offer_b') AND v_tag IS NOT NULL THEN
    -- Match drivers whose chosen active area name equals the order's address_tag.
    SELECT dp.user_id INTO v_next_driver
    FROM public.driver_profiles dp
    JOIN public.delivery_areas da ON da.id = dp.service_area_id AND da.is_active = true
    WHERE dp.is_online = true
      AND dp.service_area_id IS NOT NULL
      AND da.name = v_tag
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
  ELSIF v_new_phase IN ('offer_a','offer_b') AND v_tag IS NULL THEN
    -- No matching delivery area for this address → no driver can be assigned.
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
    'address_tag', v_tag
  );
END;
$function$;

-- 6. Update check_area_coverage to use the same derived tag for an exact match.
CREATE OR REPLACE FUNCTION public.check_area_coverage(p_lat double precision, p_lng double precision, p_address text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_online_in_area integer := 0;
  v_total_online integer := 0;
  v_tag text;
BEGIN
  SELECT count(*) INTO v_total_online
  FROM public.driver_profiles
  WHERE is_online = true;

  v_tag := public.derive_address_tag(p_address);

  IF v_tag IS NULL THEN
    RETURN jsonb_build_object(
      'covered', false,
      'online_in_area', 0,
      'total_online', v_total_online,
      'address_tag', NULL
    );
  END IF;

  SELECT count(*) INTO v_online_in_area
  FROM public.driver_profiles dp
  JOIN public.delivery_areas da ON da.id = dp.service_area_id AND da.is_active = true
  WHERE dp.is_online = true
    AND da.name = v_tag;

  RETURN jsonb_build_object(
    'covered', v_online_in_area > 0,
    'online_in_area', v_online_in_area,
    'total_online', v_total_online,
    'address_tag', v_tag
  );
END;
$function$;
