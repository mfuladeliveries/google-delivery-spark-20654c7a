
-- Rate limit counters table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier text NOT NULL,
  action text NOT NULL,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (identifier, action)
);

CREATE INDEX IF NOT EXISTS rate_limits_window_idx
  ON public.rate_limits (window_started_at);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Lock down the table: only admins can read; nobody writes directly.
CREATE POLICY "Admins view rate limits"
  ON public.rate_limits FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- check_rate_limit: returns true if allowed, false if over the limit.
-- Resets the counter when the current window has expired.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier text,
  p_action text,
  p_max_requests integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_now timestamptz := now();
  v_window_start timestamptz;
BEGIN
  IF p_identifier IS NULL OR p_identifier = '' THEN
    RETURN true; -- nothing to key on, fail open
  END IF;

  v_window_start := v_now - make_interval(secs => p_window_seconds);

  -- Try to read existing counter
  SELECT * INTO v_row
  FROM public.rate_limits
  WHERE identifier = p_identifier AND action = p_action
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    INSERT INTO public.rate_limits (identifier, action, window_started_at, request_count)
    VALUES (p_identifier, p_action, v_now, 1);
    RETURN true;
  END IF;

  -- Reset window if expired
  IF v_row.window_started_at < v_window_start THEN
    UPDATE public.rate_limits
    SET window_started_at = v_now,
        request_count = 1,
        updated_at = v_now
    WHERE id = v_row.id;
    RETURN true;
  END IF;

  IF v_row.request_count >= p_max_requests THEN
    RETURN false;
  END IF;

  UPDATE public.rate_limits
  SET request_count = request_count + 1,
      updated_at = v_now
  WHERE id = v_row.id;

  RETURN true;
END;
$$;

-- Wrap order creation with a per-user limit: 5 orders / 60 seconds.
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
  v_delivery_fee numeric := 40;
  v_display_delivery_fee numeric := 55;
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
    'delivery_fee', v_display_delivery_fee,
    'tip', p_tip,
    'total', v_subtotal + v_tax + v_display_delivery_fee + p_tip,
    'payment_method', p_payment_method
  );
END;
$$;
