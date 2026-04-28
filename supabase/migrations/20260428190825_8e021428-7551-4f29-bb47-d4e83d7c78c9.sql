-- Tighten create_verified_order: require valid coords + enforce per-restaurant 8km radius.
-- Also log invalid order attempts for admin visibility.

CREATE TABLE IF NOT EXISTS public.invalid_order_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  restaurant_name text,
  reason text NOT NULL,
  customer_lat double precision,
  customer_lng double precision,
  distance_km double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invalid_order_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view invalid attempts" ON public.invalid_order_attempts;
CREATE POLICY "Admins view invalid attempts"
ON public.invalid_order_attempts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Helper: log an invalid attempt (SECURITY DEFINER so RLS doesn't block insert).
CREATE OR REPLACE FUNCTION public.log_invalid_order_attempt(
  p_restaurant_name text,
  p_reason text,
  p_lat double precision,
  p_lng double precision,
  p_distance double precision
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.invalid_order_attempts (user_id, restaurant_name, reason, customer_lat, customer_lng, distance_km)
  VALUES (auth.uid(), p_restaurant_name, p_reason, p_lat, p_lng, p_distance);
END;
$$;

-- Replace the order RPC with stricter coord + distance validation.
CREATE OR REPLACE FUNCTION public.create_verified_order(
  p_items jsonb,
  p_restaurant_name text,
  p_customer_name text,
  p_customer_contact text,
  p_customer_address text,
  p_customer_lat double precision,
  p_customer_lng double precision,
  p_special_notes text DEFAULT ''::text,
  p_tip numeric DEFAULT 0,
  p_delivery_code text DEFAULT '0000'::text,
  p_payment_method text DEFAULT 'cash'::text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.check_rate_limit(v_user_id::text, 'create_order', 5, 60) THEN
    RAISE EXCEPTION 'Too many orders in a short time. Please wait a minute and try again.'
      USING ERRCODE = '42901';
  END IF;

  -- STRICT coordinate validation: must exist, be finite, non-zero, within Earth bounds.
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

  -- Per-restaurant 8 km radius enforcement (server-side).
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
$$;