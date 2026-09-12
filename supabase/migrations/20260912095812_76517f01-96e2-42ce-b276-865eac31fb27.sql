CREATE OR REPLACE FUNCTION public.create_verified_order(p_items jsonb, p_restaurant_name text, p_customer_name text, p_customer_contact text, p_customer_address text, p_customer_lat double precision, p_customer_lng double precision, p_special_notes text DEFAULT ''::text, p_tip numeric DEFAULT 0, p_delivery_code text DEFAULT '0000'::text, p_payment_method text DEFAULT 'online'::text, p_restaurant_id uuid DEFAULT NULL::uuid)
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
  v_verified_items jsonb := '[]'::jsonb;
  v_restaurant_id uuid;
  v_restaurant_name text;
  v_restaurant_open boolean;
  v_restaurant_active boolean;
  v_rest_lat double precision;
  v_rest_lng double precision;
  v_approval_mode text;
  v_order_number integer;
  v_order_id uuid;
  v_user_id uuid;
  v_drivers_in_zone integer := 0;
  v_init_status text;
  v_payment_initiated timestamptz;
  v_dupe record;
  v_elem jsonb;
  v_mi record;
  v_qty integer;
  v_base numeric;
  v_extras numeric;
  v_unit numeric;
  v_cut_price numeric;
  v_max_pieces integer;
  v_pieces integer;
  v_size_price numeric;
  v_cut_name text;
  v_size_name text;
  v_addon_names text[];
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

  IF p_restaurant_id IS NOT NULL THEN
    SELECT id, name, is_open, COALESCE(is_active, false), lat, lng, COALESCE(approval_mode,'auto')
      INTO v_restaurant_id, v_restaurant_name, v_restaurant_open, v_restaurant_active, v_rest_lat, v_rest_lng, v_approval_mode
    FROM restaurants WHERE id = p_restaurant_id LIMIT 1;
  ELSE
    SELECT id, name, is_open, COALESCE(is_active, false), lat, lng, COALESCE(approval_mode,'auto')
      INTO v_restaurant_id, v_restaurant_name, v_restaurant_open, v_restaurant_active, v_rest_lat, v_rest_lng, v_approval_mode
    FROM restaurants
    WHERE lower(btrim(name)) = lower(btrim(p_restaurant_name))
    ORDER BY COALESCE(is_active, false) DESC, COALESCE(is_open, false) DESC
    LIMIT 1;
  END IF;

  IF v_restaurant_id IS NULL THEN
    PERFORM public.log_invalid_order_attempt(p_restaurant_name, 'restaurant_not_found', p_customer_lat, p_customer_lng, NULL);
    RAISE EXCEPTION 'Restaurant could not be found.' USING ERRCODE = '22023';
  END IF;

  IF NOT v_restaurant_active THEN
    PERFORM public.log_invalid_order_attempt(v_restaurant_name, 'restaurant_inactive', p_customer_lat, p_customer_lng, NULL);
    RAISE EXCEPTION 'This restaurant is currently unavailable for orders.' USING ERRCODE = '22023';
  END IF;

  IF NOT COALESCE(v_restaurant_open, false) THEN
    RAISE EXCEPTION 'Restaurant is currently closed. Please try again later.' USING ERRCODE = '22023';
  END IF;

  v_zone := public.find_nearest_zone(p_customer_lat, p_customer_lng, v_rest_lat, v_rest_lng);
  IF NOT (v_zone->>'found')::boolean THEN
    PERFORM public.log_invalid_order_attempt(v_restaurant_name, 'outside_service_area', p_customer_lat, p_customer_lng, NULL);
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
    PERFORM public.log_invalid_order_attempt(v_restaurant_name, 'no_driver_online', p_customer_lat, p_customer_lng, NULL);
    RAISE EXCEPTION 'No drivers are online in your area right now. Please try again shortly.' USING ERRCODE = '22023';
  END IF;

  FOR v_elem IN SELECT elem FROM jsonb_array_elements(p_items) AS elem
  LOOP
    SELECT mi.id, mi.name, mi.price, mi.category,
           COALESCE(mi.sizes, '[]'::jsonb) AS sizes,
           COALESCE(mi.cuts, '[]'::jsonb) AS cuts,
           COALESCE(mi.add_ons, '[]'::jsonb) AS add_ons
      INTO v_mi
    FROM menu_items mi
    WHERE mi.id = (v_elem->>'id')::uuid
      AND mi.is_available = true
      AND mi.restaurant_id IN (
        SELECT id FROM restaurants
        WHERE id = v_restaurant_id
           OR lower(btrim(name)) = 'mfula shop'
      )
    LIMIT 1;

    IF v_mi.id IS NULL THEN CONTINUE; END IF;

    v_qty := GREATEST(1, COALESCE((v_elem->>'quantity')::integer, 1));
    v_base := COALESCE(v_mi.price, 0);
    v_cut_name := NULLIF(btrim(COALESCE(v_elem->>'cut', '')), '');
    v_size_name := NULLIF(btrim(COALESCE(v_elem->>'size', '')), '');
    v_pieces := GREATEST(1, COALESCE((v_elem->>'pieces')::integer, 1));

    IF v_cut_name IS NOT NULL THEN
      SELECT (c->>'price')::numeric, COALESCE((c->>'max_pieces')::integer, 1)
        INTO v_cut_price, v_max_pieces
      FROM jsonb_array_elements(v_mi.cuts) AS c
      WHERE btrim(c->>'name') = v_cut_name
      LIMIT 1;
      IF v_cut_price IS NOT NULL THEN
        IF COALESCE(v_max_pieces, 1) > 1 THEN
          v_base := v_cut_price * LEAST(v_pieces, v_max_pieces);
        ELSE
          v_base := v_cut_price;
        END IF;
      END IF;
    ELSIF v_size_name IS NOT NULL THEN
      SELECT (s->>'price')::numeric INTO v_size_price
      FROM jsonb_array_elements(v_mi.sizes) AS s
      WHERE btrim(s->>'name') = v_size_name
      LIMIT 1;
      IF v_size_price IS NOT NULL THEN v_base := v_size_price; END IF;
    END IF;

    -- Fallback: an option-priced item sent without a valid option choice still
    -- gets a real price (cheapest option) instead of being silently dropped.
    IF COALESCE(v_base, 0) <= 0 THEN
      SELECT MIN((s->>'price')::numeric) INTO v_size_price
      FROM jsonb_array_elements(v_mi.sizes) AS s;
      IF COALESCE(v_size_price, 0) > 0 THEN
        v_base := v_size_price;
      ELSE
        SELECT MIN((c->>'price')::numeric) INTO v_cut_price
        FROM jsonb_array_elements(v_mi.cuts) AS c;
        IF COALESCE(v_cut_price, 0) > 0 THEN v_base := v_cut_price; END IF;
      END IF;
    END IF;

    IF COALESCE(v_base, 0) <= 0 THEN CONTINUE; END IF;

    v_extras := 0;
    IF jsonb_typeof(v_elem->'add_ons') = 'array' THEN
      SELECT COALESCE(array_agg(btrim(x)), ARRAY[]::text[]) INTO v_addon_names
      FROM jsonb_array_elements_text(v_elem->'add_ons') AS x;
      SELECT COALESCE(SUM((a->>'price')::numeric), 0) INTO v_extras
      FROM jsonb_array_elements(v_mi.add_ons) AS a
      WHERE btrim(a->>'name') = ANY (v_addon_names);
    END IF;

    v_unit := ROUND(v_base + COALESCE(v_extras, 0), 2);
    v_subtotal := v_subtotal + (v_unit * v_qty);
    v_verified_items := v_verified_items || jsonb_build_object(
      'id', v_mi.id, 'name', v_mi.name, 'category', v_mi.category,
      'price', v_unit, 'quantity', v_qty,
      'size', v_size_name, 'cut', v_cut_name,
      'pieces', CASE WHEN v_pieces > 1 THEN v_pieces ELSE NULL END,
      'add_ons', COALESCE(v_elem->'add_ons', '[]'::jsonb));
  END LOOP;

  IF v_subtotal = 0 THEN RAISE EXCEPTION 'No valid items in order' USING ERRCODE = '22023'; END IF;

  v_tax := ROUND(v_subtotal * 0.05, 2);
  v_total := v_subtotal + v_tax + v_delivery_fee + p_tip;

  IF v_approval_mode IN ('restaurant','admin') THEN
    v_init_status := 'awaiting_restaurant';
    v_payment_initiated := NULL;
  ELSE
    v_init_status := 'pending_payment';
    v_payment_initiated := now();
  END IF;

  SELECT o.id, o.order_number, o.subtotal, o.tax, o.delivery_fee, o.total, o.status
    INTO v_dupe
  FROM orders o
  WHERE o.user_id = v_user_id
    AND o.restaurant_id = v_restaurant_id
    AND o.status IN ('pending_payment', 'awaiting_restaurant')
    AND COALESCE(o.payment_status, 'pending') <> 'paid'
    AND o.created_at > now() - interval '15 minutes'
    AND o.items = v_verified_items
    AND o.tip = p_tip
  ORDER BY o.created_at DESC
  LIMIT 1;

  IF v_dupe.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'order_id', v_dupe.id,
      'order_number', v_dupe.order_number,
      'subtotal', v_dupe.subtotal,
      'tax', v_dupe.tax,
      'delivery_fee', v_dupe.delivery_fee,
      'total', v_dupe.total,
      'status', v_dupe.status,
      'zone_name', v_zone_name,
      'restaurant_id', v_restaurant_id,
      'reused', true
    );
  END IF;

  INSERT INTO orders (
    user_id, customer_id, restaurant_id, restaurant,
    items, subtotal, tax, delivery_fee, tip, total,
    customer_name, customer_contact, customer_address,
    customer_lat, customer_lng, special_notes, delivery_code,
    payment_method, payment_status, status, payment_initiated_at
  ) VALUES (
    v_user_id, v_user_id, v_restaurant_id, v_restaurant_name,
    v_verified_items, v_subtotal, v_tax, v_delivery_fee, p_tip, v_total,
    p_customer_name, p_customer_contact, p_customer_address,
    p_customer_lat, p_customer_lng, p_special_notes, p_delivery_code,
    p_payment_method, 'pending', v_init_status, v_payment_initiated
  )
  RETURNING id, order_number INTO v_order_id, v_order_number;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'tax', v_tax,
    'delivery_fee', v_delivery_fee,
    'total', v_total,
    'status', v_init_status,
    'zone_name', v_zone_name,
    'restaurant_id', v_restaurant_id
  );
END;
$function$;