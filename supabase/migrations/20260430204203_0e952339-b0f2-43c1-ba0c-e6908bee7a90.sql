-- 1. Add pricing columns
ALTER TABLE public.delivery_areas
  ADD COLUMN IF NOT EXISTS base_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_per_km numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_fee numeric,
  ADD COLUMN IF NOT EXISTS max_fee numeric;

-- 2. Backfill: existing flat delivery_fee becomes the base fee
UPDATE public.delivery_areas
SET base_fee = COALESCE(delivery_fee, 0)
WHERE base_fee = 0 AND delivery_fee IS NOT NULL;

-- 3. Validation constraints
ALTER TABLE public.delivery_areas
  DROP CONSTRAINT IF EXISTS delivery_areas_base_fee_nonneg,
  DROP CONSTRAINT IF EXISTS delivery_areas_price_per_km_nonneg,
  DROP CONSTRAINT IF EXISTS delivery_areas_min_fee_nonneg,
  DROP CONSTRAINT IF EXISTS delivery_areas_max_fee_nonneg,
  DROP CONSTRAINT IF EXISTS delivery_areas_min_le_max;

ALTER TABLE public.delivery_areas
  ADD CONSTRAINT delivery_areas_base_fee_nonneg CHECK (base_fee >= 0),
  ADD CONSTRAINT delivery_areas_price_per_km_nonneg CHECK (price_per_km >= 0),
  ADD CONSTRAINT delivery_areas_min_fee_nonneg CHECK (min_fee IS NULL OR min_fee >= 0),
  ADD CONSTRAINT delivery_areas_max_fee_nonneg CHECK (max_fee IS NULL OR max_fee >= 0),
  ADD CONSTRAINT delivery_areas_min_le_max
    CHECK (min_fee IS NULL OR max_fee IS NULL OR min_fee <= max_fee);

-- 4. Prevent duplicate area names (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS delivery_areas_name_lower_uniq
  ON public.delivery_areas (lower(name));

-- 5. Helper: clamp + compute the fee
CREATE OR REPLACE FUNCTION public.calc_zone_fee(
  p_base numeric,
  p_per_km numeric,
  p_min numeric,
  p_max numeric,
  p_distance_km double precision
) RETURNS numeric
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT
    CASE
      WHEN p_max IS NOT NULL AND v > p_max THEN p_max
      WHEN p_min IS NOT NULL AND v < p_min THEN p_min
      ELSE v
    END
  FROM (
    SELECT ROUND(
      COALESCE(p_base, 0) + COALESCE(p_per_km, 0) * COALESCE(p_distance_km, 0)::numeric,
      2
    ) AS v
  ) s;
$$;

-- 6. Rewrite find_nearest_zone to optionally take a restaurant location
--    and return the calculated delivery fee for that pair.
CREATE OR REPLACE FUNCTION public.find_nearest_zone(
  p_lat double precision,
  p_lng double precision,
  p_restaurant_lat double precision DEFAULT NULL,
  p_restaurant_lng double precision DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_zone RECORD;
  v_pricing_distance double precision;
  v_fee numeric;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RETURN jsonb_build_object('found', false, 'reason', 'missing_coords');
  END IF;

  SELECT da.id, da.name, da.suburb, da.radius_km,
         da.base_fee, da.price_per_km, da.min_fee, da.max_fee,
         da.delivery_fee,
         public.distance_km(da.lat, da.lng, p_lat, p_lng) AS distance_km
  INTO v_zone
  FROM public.delivery_areas da
  WHERE da.is_active = true
    AND da.lat IS NOT NULL
    AND da.lng IS NOT NULL
    AND public.distance_km(da.lat, da.lng, p_lat, p_lng) <= da.radius_km
  ORDER BY public.distance_km(da.lat, da.lng, p_lat, p_lng) ASC
  LIMIT 1;

  IF v_zone.id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'reason', 'out_of_range');
  END IF;

  -- Distance used for pricing: restaurant -> customer when restaurant coords given,
  -- else fall back to zone-centre -> customer (legacy behaviour).
  IF p_restaurant_lat IS NOT NULL AND p_restaurant_lng IS NOT NULL THEN
    v_pricing_distance := public.distance_km(p_restaurant_lat, p_restaurant_lng, p_lat, p_lng);
  ELSE
    v_pricing_distance := v_zone.distance_km;
  END IF;

  v_fee := public.calc_zone_fee(
    v_zone.base_fee, v_zone.price_per_km, v_zone.min_fee, v_zone.max_fee,
    v_pricing_distance
  );

  RETURN jsonb_build_object(
    'found', true,
    'zone_id', v_zone.id,
    'zone_name', v_zone.name,
    'suburb', v_zone.suburb,
    'radius_km', v_zone.radius_km,
    'distance_km', v_zone.distance_km,
    'pricing_distance_km', v_pricing_distance,
    'base_fee', v_zone.base_fee,
    'price_per_km', v_zone.price_per_km,
    'min_fee', v_zone.min_fee,
    'max_fee', v_zone.max_fee,
    'delivery_fee', v_fee
  );
END;
$$;

-- 7. Public RPC for the cart/checkout to preview the calculated fee.
CREATE OR REPLACE FUNCTION public.calc_delivery_fee(
  p_lat double precision,
  p_lng double precision,
  p_restaurant_name text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rest_lat double precision;
  v_rest_lng double precision;
BEGIN
  IF p_restaurant_name IS NOT NULL THEN
    SELECT lat, lng INTO v_rest_lat, v_rest_lng
    FROM public.restaurants
    WHERE name = p_restaurant_name AND is_active = true
    LIMIT 1;
  END IF;
  RETURN public.find_nearest_zone(p_lat, p_lng, v_rest_lat, v_rest_lng);
END;
$$;

-- 8. Update create_verified_order to use the new pricing
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
  p_payment_method text DEFAULT 'online'::text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_subtotal numeric := 0;
  v_tax numeric;
  v_delivery_fee numeric;
  v_zone jsonb;
  v_zone_name text;
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

  -- Zone-based service check with restaurant-distance pricing
  v_zone := public.find_nearest_zone(p_customer_lat, p_customer_lng, v_rest_lat, v_rest_lng);
  IF NOT (v_zone->>'found')::boolean THEN
    PERFORM public.log_invalid_order_attempt(p_restaurant_name, 'outside_service_area', p_customer_lat, p_customer_lng, NULL);
    RAISE EXCEPTION 'Delivery is not available in your area yet.'
      USING ERRCODE = '22023';
  END IF;
  v_delivery_fee := (v_zone->>'delivery_fee')::numeric;
  v_zone_name    := v_zone->>'zone_name';

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
$$;