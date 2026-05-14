
CREATE OR REPLACE FUNCTION public.create_verified_order(p_items jsonb, p_restaurant_name text, p_customer_name text, p_customer_contact text, p_customer_address text, p_customer_lat double precision, p_customer_lng double precision, p_special_notes text DEFAULT ''::text, p_tip numeric DEFAULT 0, p_delivery_code text DEFAULT '0000'::text, p_payment_method text DEFAULT 'online'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  v_order_number integer;
  v_order_id uuid;
  v_user_id uuid;
  v_drivers_in_zone integer := 0;
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

  IF p_payment_method <> 'online' THEN
    RAISE EXCEPTION 'Only online payment is supported';
  END IF;

  SELECT id, is_open, lat, lng
    INTO v_restaurant_id, v_restaurant_open, v_rest_lat, v_rest_lng
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

  v_zone := public.find_nearest_zone(p_customer_lat, p_customer_lng, v_rest_lat, v_rest_lng);
  IF NOT (v_zone->>'found')::boolean THEN
    PERFORM public.log_invalid_order_attempt(p_restaurant_name, 'outside_service_area', p_customer_lat, p_customer_lng, NULL);
    RAISE EXCEPTION 'Delivery is not available in your area yet.'
      USING ERRCODE = '22023';
  END IF;
  v_delivery_fee := (v_zone->>'delivery_fee')::numeric;
  v_zone_name    := v_zone->>'zone_name';
  v_zone_id      := (v_zone->>'zone_id')::uuid;

  -- Block ordering when no driver is currently online in this zone
  SELECT count(DISTINCT dp.user_id) INTO v_drivers_in_zone
  FROM public.driver_profiles dp
  JOIN public.driver_service_areas dsa ON dsa.driver_id = dp.user_id
  WHERE dp.is_online = true
    AND dsa.area_id = v_zone_id;

  IF v_drivers_in_zone = 0 THEN
    PERFORM public.log_invalid_order_attempt(p_restaurant_name, 'no_driver_online', p_customer_lat, p_customer_lng, NULL);
    RAISE EXCEPTION 'No drivers are online in your area right now. Please try again shortly.'
      USING ERRCODE = '22023';
  END IF;

  FOR v_item IN
    SELECT mi.id, mi.name, mi.price, mi.category,
           (elem->>'quantity')::integer AS quantity
    FROM jsonb_array_elements(p_items) AS elem
    JOIN menu_items mi ON mi.id = (elem->>'id')::uuid
    WHERE mi.is_available = true
  LOOP
    v_subtotal := v_subtotal + (v_item.price * v_item.quantity);
    v_verified_items := v_verified_items || jsonb_build_object(
      'id', v_item.id, 'name', v_item.name, 'category', v_item.category,
      'price', v_item.price, 'quantity', v_item.quantity
    );
  END LOOP;

  IF v_subtotal = 0 THEN
    RAISE EXCEPTION 'No valid items in order';
  END IF;

  v_tax := ROUND(v_subtotal * 0.05, 2);
  v_total := v_subtotal + v_tax + v_delivery_fee + p_tip;

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
    'pending_payment', 'pending', 'online', 'payfast',
    now(), v_zone_name
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
    'payment_method', 'online',
    'zone_name', v_zone_name,
    'address_tag', v_zone_name,
    'pricing_distance_km', (v_zone->>'pricing_distance_km')::numeric,
    'status', 'pending_payment'
  );
END;
$function$;
