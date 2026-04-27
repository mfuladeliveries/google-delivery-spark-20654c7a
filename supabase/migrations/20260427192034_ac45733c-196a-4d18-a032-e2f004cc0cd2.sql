-- Add is_online check to driver_accept_offer and is_open check to create_verified_order
CREATE OR REPLACE FUNCTION public.driver_accept_offer(p_order_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_driver uuid := auth.uid();
  v_online boolean;
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
    AND driver_id IS NULL;

  RETURN FOUND;
END;
$function$;

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
  v_order_number integer;
  v_order_id uuid;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.check_rate_limit(v_user_id::text, 'create_order', 5, 60) THEN
    RAISE EXCEPTION 'Too many orders in a short time. Please wait a minute and try again.'
      USING ERRCODE = '42901';
  END IF;

  IF p_tip < 0 OR p_tip > 10000 THEN
    RAISE EXCEPTION 'Invalid tip amount';
  END IF;

  IF p_payment_method NOT IN ('cash', 'online') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  v_service := public.check_service_area(p_customer_lat, p_customer_lng);
  IF NOT (v_service->>'in_range')::boolean THEN
    RAISE EXCEPTION 'Delivery not available in your area.'
      USING ERRCODE = '22023';
  END IF;
  v_delivery_fee := (v_service->>'fee')::numeric;

  SELECT id, is_open INTO v_restaurant_id, v_restaurant_open
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

  INSERT INTO orders (
    user_id, customer_id, restaurant_id, restaurant,
    items, subtotal, tax, delivery_fee, tip, total,
    customer_name, customer_contact, customer_address,
    customer_lat, customer_lng,
    special_notes, delivery_code, admin_delivery_code,
    status, payment_status, payment_method
  ) VALUES (
    v_user_id, v_user_id, v_restaurant_id, p_restaurant_name,
    v_verified_items, v_subtotal, v_tax, v_delivery_fee, p_tip, v_total,
    p_customer_name, p_customer_contact, p_customer_address,
    p_customer_lat, p_customer_lng,
    p_special_notes, p_delivery_code, p_delivery_code,
    'ready', 'pending', p_payment_method
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
    'payment_method', p_payment_method
  );
END;
$function$;