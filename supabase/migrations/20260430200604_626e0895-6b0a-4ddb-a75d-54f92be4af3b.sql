-- ============================================================
-- 1. Extend delivery_areas with coords / radius / fee
-- ============================================================
ALTER TABLE public.delivery_areas
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS radius_km numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS delivery_fee numeric NOT NULL DEFAULT 65;

-- Sane bounds
ALTER TABLE public.delivery_areas
  DROP CONSTRAINT IF EXISTS delivery_areas_radius_chk,
  ADD  CONSTRAINT delivery_areas_radius_chk CHECK (radius_km > 0 AND radius_km <= 50);

-- Default existing rows to inactive until admin sets a centre point.
UPDATE public.delivery_areas SET is_active = false WHERE lat IS NULL OR lng IS NULL;

-- Seed the four required zones (idempotent, inactive, no coords).
INSERT INTO public.delivery_areas (name, suburb, is_active, radius_km, delivery_fee)
VALUES
  ('Mfuleni',     '', false, 5, 65),
  ('Khayelitsha', '', false, 5, 65),
  ('Atlantis',    '', false, 5, 65),
  ('Malmesbury',  '', false, 5, 65)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. driver_service_areas (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.driver_service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  area_id uuid NOT NULL REFERENCES public.delivery_areas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, area_id)
);

CREATE INDEX IF NOT EXISTS idx_driver_service_areas_driver ON public.driver_service_areas(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_service_areas_area   ON public.driver_service_areas(area_id);

ALTER TABLE public.driver_service_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers manage own zones"   ON public.driver_service_areas;
DROP POLICY IF EXISTS "Admins manage driver zones" ON public.driver_service_areas;
DROP POLICY IF EXISTS "Anyone authenticated can view driver zones" ON public.driver_service_areas;

CREATE POLICY "Drivers manage own zones"
ON public.driver_service_areas
FOR ALL
TO authenticated
USING (auth.uid() = driver_id)
WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Admins manage driver zones"
ON public.driver_service_areas
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 3. Backfill: copy any existing single-zone driver into the new table
-- ============================================================
INSERT INTO public.driver_service_areas (driver_id, area_id)
SELECT user_id, service_area_id
FROM public.driver_profiles
WHERE service_area_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. New helper: find_nearest_zone(lat,lng) → jsonb
--    Returns the closest active zone whose radius covers the point.
-- ============================================================
CREATE OR REPLACE FUNCTION public.find_nearest_zone(p_lat double precision, p_lng double precision)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_zone RECORD;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RETURN jsonb_build_object('found', false, 'reason', 'missing_coords');
  END IF;

  SELECT da.id, da.name, da.suburb, da.delivery_fee, da.radius_km,
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

  RETURN jsonb_build_object(
    'found', true,
    'zone_id', v_zone.id,
    'zone_name', v_zone.name,
    'suburb', v_zone.suburb,
    'delivery_fee', v_zone.delivery_fee,
    'radius_km', v_zone.radius_km,
    'distance_km', v_zone.distance_km
  );
END;
$$;

-- ============================================================
-- 5. derive_address_tag now uses coordinates instead of text matching
-- ============================================================
CREATE OR REPLACE FUNCTION public.derive_address_tag(p_address text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  -- Legacy signature kept for any callers; coordinate-based logic now lives
  -- in find_nearest_zone. Returns NULL since we no longer match by text.
  SELECT NULL::text WHERE p_address IS NOT NULL;
$$;

-- ============================================================
-- 6. check_area_coverage — coordinate-based, ignores address text
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_area_coverage(p_lat double precision, p_lng double precision, p_address text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_zone jsonb;
  v_total_online integer := 0;
  v_in_zone integer := 0;
  v_zone_id uuid;
BEGIN
  SELECT count(*) INTO v_total_online
  FROM public.driver_profiles WHERE is_online = true;

  v_zone := public.find_nearest_zone(p_lat, p_lng);

  IF NOT (v_zone->>'found')::boolean THEN
    RETURN jsonb_build_object(
      'covered', false,
      'in_zone', false,
      'online_in_area', 0,
      'total_online', v_total_online,
      'zone_id', NULL,
      'zone_name', NULL,
      'address_tag', NULL,
      'distance_km', (v_zone->>'distance_km')::numeric
    );
  END IF;

  v_zone_id := (v_zone->>'zone_id')::uuid;

  SELECT count(DISTINCT dp.user_id) INTO v_in_zone
  FROM public.driver_profiles dp
  JOIN public.driver_service_areas dsa ON dsa.driver_id = dp.user_id
  WHERE dp.is_online = true
    AND dsa.area_id = v_zone_id;

  RETURN jsonb_build_object(
    'covered', v_in_zone > 0,
    'in_zone', true,
    'online_in_area', v_in_zone,
    'total_online', v_total_online,
    'zone_id', v_zone_id,
    'zone_name', v_zone->>'zone_name',
    'address_tag', v_zone->>'zone_name',
    'distance_km', (v_zone->>'distance_km')::numeric,
    'delivery_fee', (v_zone->>'delivery_fee')::numeric
  );
END;
$$;

-- ============================================================
-- 7. create_verified_order — zone-based gating + per-zone fee
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_verified_order(
  p_items jsonb,
  p_restaurant_name text,
  p_customer_name text,
  p_customer_contact text,
  p_customer_address text,
  p_customer_lat double precision,
  p_customer_lng double precision,
  p_special_notes text DEFAULT '',
  p_tip numeric DEFAULT 0,
  p_delivery_code text DEFAULT '0000',
  p_payment_method text DEFAULT 'online'
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
  v_zone jsonb;
  v_zone_name text;
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

  -- Zone-based service check (replaces 8km restaurant + global service area)
  v_zone := public.find_nearest_zone(p_customer_lat, p_customer_lng);
  IF NOT (v_zone->>'found')::boolean THEN
    PERFORM public.log_invalid_order_attempt(p_restaurant_name, 'outside_service_area', p_customer_lat, p_customer_lng, NULL);
    RAISE EXCEPTION 'Sorry, delivery is only available within 5km of this area.'
      USING ERRCODE = '22023';
  END IF;
  v_delivery_fee := (v_zone->>'delivery_fee')::numeric;
  v_zone_name    := v_zone->>'zone_name';

  SELECT id, is_open
    INTO v_restaurant_id, v_restaurant_open
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
    'status', 'pending_payment'
  );
END;
$$;

-- ============================================================
-- 8. dispatch_assign_next — match drivers via driver_service_areas + order coords
-- ============================================================
CREATE OR REPLACE FUNCTION public.dispatch_assign_next(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_next_driver uuid;
  v_previous_driver uuid;
  v_new_phase text;
  v_offer_seconds integer := 180;
  v_zone jsonb;
  v_zone_id uuid;
  v_zone_name text;
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

  -- Resolve zone from order coords
  v_zone := public.find_nearest_zone(v_order.customer_lat, v_order.customer_lng);
  IF (v_zone->>'found')::boolean THEN
    v_zone_id   := (v_zone->>'zone_id')::uuid;
    v_zone_name := v_zone->>'zone_name';
    -- Persist zone name on the order for grouping/UI
    IF v_order.address_tag IS DISTINCT FROM v_zone_name THEN
      UPDATE public.orders SET address_tag = v_zone_name WHERE id = p_order_id;
    END IF;
  END IF;

  IF v_new_phase IN ('offer_a','offer_b') AND v_zone_id IS NOT NULL THEN
    SELECT dp.user_id INTO v_next_driver
    FROM public.driver_profiles dp
    JOIN public.driver_service_areas dsa ON dsa.driver_id = dp.user_id AND dsa.area_id = v_zone_id
    WHERE dp.is_online = true
      AND NOT (dp.user_id = ANY(COALESCE(v_order.missed_by_driver_ids, ARRAY[]::uuid[])))
      AND NOT EXISTS (
        SELECT 1 FROM public.orders o2
        WHERE o2.driver_id = dp.user_id
          AND o2.status IN ('driver_assigned','picking_up','arrived_at_restaurant','out_for_delivery')
      )
    ORDER BY dp.location_updated_at DESC NULLS LAST
    LIMIT 1;

    IF v_next_driver IS NULL THEN
      v_new_phase := 'waiting';
    END IF;
  ELSIF v_new_phase IN ('offer_a','offer_b') THEN
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
    'zone_id', v_zone_id,
    'zone_name', v_zone_name
  );
END;
$$;

-- ============================================================
-- 9. Earnings trigger — simple 70/30 split on the per-zone delivery_fee
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_driver_earnings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_fee numeric;
  v_driver_share numeric;
  v_platform_share numeric;
BEGIN
  IF NEW.status = 'delivered'
     AND (OLD.status IS DISTINCT FROM 'delivered')
     AND NEW.driver_id IS NOT NULL THEN

    v_customer_fee := COALESCE(NEW.delivery_fee, 0);
    v_driver_share := ROUND(v_customer_fee * 0.70, 2);
    v_platform_share := GREATEST(v_customer_fee - v_driver_share, 0);

    INSERT INTO public.driver_earnings (driver_id, order_id, delivery_fee, driver_payout, platform_fee)
    VALUES (NEW.driver_id, NEW.id, v_customer_fee, v_driver_share, v_platform_share)
    ON CONFLICT DO NOTHING;

    UPDATE public.driver_profiles
    SET total_earnings = total_earnings + v_driver_share,
        total_deliveries = total_deliveries + 1,
        updated_at = now()
    WHERE user_id = NEW.driver_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 10. Drop legacy global service_area config (no longer used)
-- ============================================================
DELETE FROM public.app_settings WHERE key IN ('service_area', 'delivery_fees');

-- ============================================================
-- 11. Helpful index for zone lookups
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_delivery_areas_active_coords
  ON public.delivery_areas(is_active) WHERE lat IS NOT NULL AND lng IS NOT NULL;
