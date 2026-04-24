-- 1. Add GPS columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

-- 2. Add GPS columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_lat double precision,
  ADD COLUMN IF NOT EXISTS customer_lng double precision;

-- 3. Seed service area config (single row)
INSERT INTO public.app_settings (key, value)
VALUES (
  'service_area',
  jsonb_build_object(
    'center_lat', -34.0233,
    'center_lng', 18.6781,
    'inner_radius_km', 5,
    'outer_radius_km', 10,
    'inner_fee', 65,
    'outer_fee', 75
  )
)
ON CONFLICT (key) DO NOTHING;

-- 4. Distance helper (haversine, km)
CREATE OR REPLACE FUNCTION public.distance_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT 6371 * acos(
    LEAST(1.0, GREATEST(-1.0,
      cos(radians(lat1)) * cos(radians(lat2))
      * cos(radians(lng2) - radians(lng1))
      + sin(radians(lat1)) * sin(radians(lat2))
    ))
  );
$$;

-- 5. New serviceability check — returns {in_range, fee, distance_km}
CREATE OR REPLACE FUNCTION public.check_service_area(
  p_lat double precision, p_lng double precision
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v jsonb;
  v_center_lat double precision;
  v_center_lng double precision;
  v_inner_km   double precision;
  v_outer_km   double precision;
  v_inner_fee  numeric;
  v_outer_fee  numeric;
  v_dist       double precision;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RETURN jsonb_build_object('in_range', false, 'reason', 'missing_coords');
  END IF;

  SELECT value INTO v FROM public.app_settings WHERE key = 'service_area';
  IF v IS NULL THEN
    RETURN jsonb_build_object('in_range', false, 'reason', 'not_configured');
  END IF;

  v_center_lat := (v->>'center_lat')::double precision;
  v_center_lng := (v->>'center_lng')::double precision;
  v_inner_km   := (v->>'inner_radius_km')::double precision;
  v_outer_km   := (v->>'outer_radius_km')::double precision;
  v_inner_fee  := (v->>'inner_fee')::numeric;
  v_outer_fee  := (v->>'outer_fee')::numeric;

  v_dist := public.distance_km(v_center_lat, v_center_lng, p_lat, p_lng);

  IF v_dist <= v_inner_km THEN
    RETURN jsonb_build_object('in_range', true, 'fee', v_inner_fee, 'distance_km', v_dist);
  ELSIF v_dist <= v_outer_km THEN
    RETURN jsonb_build_object('in_range', true, 'fee', v_outer_fee, 'distance_km', v_dist);
  ELSE
    RETURN jsonb_build_object('in_range', false, 'reason', 'out_of_range', 'distance_km', v_dist);
  END IF;
END;
$$;

-- 6. Drop old zone detection (no longer used)
DROP FUNCTION IF EXISTS public.detect_delivery_zone(text);

-- 7. New version of create_verified_order using GPS instead of zones
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
)
RETURNS jsonb
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

  -- Service area check (distance-based, hidden from customer)
  v_service := public.check_service_area(p_customer_lat, p_customer_lng);
  IF NOT (v_service->>'in_range')::boolean THEN
    RAISE EXCEPTION 'Delivery not available in your area.'
      USING ERRCODE = '22023';
  END IF;
  v_delivery_fee := (v_service->>'fee')::numeric;

  SELECT id INTO v_restaurant_id
  FROM restaurants
  WHERE name = p_restaurant_name AND is_active = true
  LIMIT 1;

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

-- 8. Drop the old zone-based overload(s) so callers must use the new GPS version
DROP FUNCTION IF EXISTS public.create_verified_order(jsonb, text, text, text, text, text, numeric, text);
DROP FUNCTION IF EXISTS public.create_verified_order(jsonb, text, text, text, text, text, numeric, text, text);