
-- Helper: detect delivery zone from a free-text address.
-- Returns 1, 2, or NULL.
CREATE OR REPLACE FUNCTION public.detect_delivery_zone(p_address text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text := lower(coalesce(p_address, ''));
BEGIN
  IF v = '' THEN RETURN NULL; END IF;

  -- Zone 1
  IF v ~ '(^|[^a-z])mfuleni([^a-z]|$)'
     OR v ~ '(^|[^a-z])bluedowns([^a-z]|$)'
     OR v ~ '(^|[^a-z])blue\s*downs([^a-z]|$)'
     OR v ~ '(^|[^a-z])bosasa([^a-z]|$)'
     OR v ~ '(^|[^a-z])bardale([^a-z]|$)'
     OR v ~ '(^|[^a-z])belladonna([^a-z]|$)'
  THEN
    RETURN 1;
  END IF;

  -- Zone 2
  IF v ~ '(^|[^a-z])eesteriver([^a-z]|$)'
     OR v ~ '(^|[^a-z])eerste\s*river([^a-z]|$)'
     OR v ~ '(^|[^a-z])summerville([^a-z]|$)'
     OR v ~ '(^|[^a-z])blackheath([^a-z]|$)'
  THEN
    RETURN 2;
  END IF;

  RETURN NULL;
END;
$$;

-- Update create_verified_order to use zone pricing
CREATE OR REPLACE FUNCTION public.create_verified_order(
  p_items jsonb,
  p_restaurant_name text,
  p_customer_name text,
  p_customer_contact text,
  p_customer_address text,
  p_special_notes text DEFAULT ''::text,
  p_tip numeric DEFAULT 0,
  p_delivery_code text DEFAULT '0000'::text,
  p_payment_method text DEFAULT 'cash'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtotal numeric := 0;
  v_tax numeric;
  v_delivery_fee numeric;       -- internal/server fee == customer fee now
  v_zone integer;
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

  -- Rate limit: 5 orders per 60s per user
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

  -- Zone detection from address
  v_zone := public.detect_delivery_zone(p_customer_address);
  IF v_zone = 1 THEN
    v_delivery_fee := 65;
  ELSIF v_zone = 2 THEN
    v_delivery_fee := 75;
  ELSE
    RAISE EXCEPTION 'Sorry, your address is outside our delivery area. We deliver to: Mfuleni, Bluedowns, Bosasa, Bardale Village, Belladonna, Eesteriver, Summerville, Blackheath.'
      USING ERRCODE = '22023';
  END IF;

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
    special_notes, delivery_code, admin_delivery_code, status, payment_status, payment_method
  ) VALUES (
    v_user_id, v_user_id, v_restaurant_id, p_restaurant_name,
    v_verified_items, v_subtotal, v_tax, v_delivery_fee, p_tip, v_total,
    p_customer_name, p_customer_contact, p_customer_address,
    p_special_notes, p_delivery_code, p_delivery_code, 'ready', 'pending', p_payment_method
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
    'zone', v_zone
  );
END;
$$;

-- Update driver earnings to use the actual delivery_fee charged (not hardcoded R55)
CREATE OR REPLACE FUNCTION public.update_driver_earnings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_fee numeric;
  v_driver_share numeric;
  v_platform_share numeric;
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') AND NEW.driver_id IS NOT NULL THEN
    v_customer_fee := COALESCE(NEW.delivery_fee, 65);
    v_driver_share := ROUND(v_customer_fee * 0.70, 2);
    v_platform_share := ROUND(v_customer_fee * 0.30, 2);

    INSERT INTO public.driver_earnings (driver_id, order_id, delivery_fee, driver_payout, platform_fee)
    VALUES (NEW.driver_id, NEW.id, v_customer_fee, v_driver_share, v_platform_share)
    ON CONFLICT (order_id) DO NOTHING;

    UPDATE driver_profiles
    SET total_earnings = total_earnings + v_driver_share,
        total_deliveries = total_deliveries + 1,
        updated_at = now()
    WHERE user_id = NEW.driver_id;
  END IF;
  RETURN NEW;
END;
$$;
