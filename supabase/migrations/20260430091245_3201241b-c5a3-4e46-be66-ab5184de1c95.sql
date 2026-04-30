-- ============================================================
-- PayFast payments: pending_payment status + payment_transactions
-- ============================================================

-- 1. New columns on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS payment_provider_txn_id text,
  ADD COLUMN IF NOT EXISTS payment_initiated_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_failure_reason text;

CREATE INDEX IF NOT EXISTS idx_orders_payment_provider_txn
  ON public.orders (payment_provider_txn_id);

CREATE INDEX IF NOT EXISTS idx_orders_pending_payment
  ON public.orders (user_id, created_at DESC)
  WHERE status = 'pending_payment';

-- 2. Payment transactions audit table (every ITN we receive)
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'payfast',
  provider_txn_id text,
  payment_status text NOT NULL,
  amount_gross numeric,
  amount_fee numeric,
  amount_net numeric,
  payment_method text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature_valid boolean NOT NULL DEFAULT false,
  source_ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_txn_order ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_txn_provider_id ON public.payment_transactions(provider, provider_txn_id);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view all payment transactions" ON public.payment_transactions;
CREATE POLICY "Admins view all payment transactions"
  ON public.payment_transactions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Customers view own payment transactions" ON public.payment_transactions;
CREATE POLICY "Customers view own payment transactions"
  ON public.payment_transactions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = payment_transactions.order_id AND o.user_id = auth.uid()
  ));
-- inserts are server-side only via SECURITY DEFINER RPC

-- 3. Hide pending_payment orders from restaurants and drivers
DROP POLICY IF EXISTS "Restaurant owners can view their orders" ON public.orders;
CREATE POLICY "Restaurant owners can view their orders"
  ON public.orders FOR SELECT TO public
  USING (
    EXISTS (SELECT 1 FROM public.restaurants r
            WHERE r.id = orders.restaurant_id AND r.owner_user_id = auth.uid())
    AND orders.status <> 'pending_payment'
  );

DROP POLICY IF EXISTS "Drivers can view targeted offers" ON public.orders;
CREATE POLICY "Drivers can view targeted offers"
  ON public.orders FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver'::public.app_role)
    AND status = 'ready'
    AND driver_id IS NULL
    AND (offered_to_driver_id = auth.uid() OR dispatch_phase = 'broadcast')
  );

-- 4. Replace create_verified_order: now creates order in 'pending_payment' for online,
--    skips dispatch. Cash flow is removed (PayFast-only).
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
)
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

  -- Online-only
  IF p_payment_method <> 'online' THEN
    RAISE EXCEPTION 'Only online payment is supported';
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
  v_address_tag := public.derive_address_tag(p_customer_address);

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
    now(), v_address_tag
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
    'address_tag', v_address_tag,
    'status', 'pending_payment'
  );
END;
$function$;

-- 5. Confirm payment (called from ITN webhook). Idempotent.
CREATE OR REPLACE FUNCTION public.confirm_payfast_payment(
  p_order_id uuid,
  p_provider_txn_id text,
  p_amount_gross numeric,
  p_amount_fee numeric,
  p_amount_net numeric,
  p_payment_method text,
  p_raw_payload jsonb,
  p_source_ip text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_was_pending boolean := false;
BEGIN
  SELECT id, status, total, restaurant, order_number, user_id
    INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Amount tamper check (allow 1 cent rounding)
  IF ABS(COALESCE(p_amount_gross,0) - v_order.total) > 0.05 THEN
    INSERT INTO public.payment_transactions
      (order_id, provider, provider_txn_id, payment_status, amount_gross, amount_fee, amount_net,
       payment_method, raw_payload, signature_valid, source_ip)
    VALUES
      (p_order_id, 'payfast', p_provider_txn_id, 'amount_mismatch',
       p_amount_gross, p_amount_fee, p_amount_net, p_payment_method, p_raw_payload, true, p_source_ip);
    RAISE EXCEPTION 'Payment amount does not match order total';
  END IF;

  INSERT INTO public.payment_transactions
    (order_id, provider, provider_txn_id, payment_status, amount_gross, amount_fee, amount_net,
     payment_method, raw_payload, signature_valid, source_ip)
  VALUES
    (p_order_id, 'payfast', p_provider_txn_id, 'COMPLETE',
     p_amount_gross, p_amount_fee, p_amount_net, p_payment_method, p_raw_payload, true, p_source_ip);

  -- Idempotent: only flip if currently pending_payment
  IF v_order.status = 'pending_payment' THEN
    UPDATE public.orders SET
      status = 'ready',
      payment_status = 'paid',
      payment_provider_txn_id = p_provider_txn_id,
      payment_completed_at = now()
    WHERE id = p_order_id;
    v_was_pending := true;
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'restaurant', v_order.restaurant,
    'total', v_order.total,
    'user_id', v_order.user_id,
    'newly_paid', v_was_pending
  );
END;
$function$;

-- 6. Mark payment failed/cancelled (called from ITN webhook on FAILED/CANCELLED)
CREATE OR REPLACE FUNCTION public.mark_payfast_payment_failed(
  p_order_id uuid,
  p_provider_txn_id text,
  p_status text,
  p_reason text,
  p_raw_payload jsonb,
  p_source_ip text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.payment_transactions
    (order_id, provider, provider_txn_id, payment_status, raw_payload, signature_valid, source_ip)
  VALUES
    (p_order_id, 'payfast', p_provider_txn_id, COALESCE(p_status,'FAILED'),
     p_raw_payload, true, p_source_ip);

  UPDATE public.orders SET
    payment_status = 'failed',
    payment_failed_at = now(),
    payment_failure_reason = p_reason,
    payment_provider_txn_id = COALESCE(p_provider_txn_id, payment_provider_txn_id)
  WHERE id = p_order_id AND status = 'pending_payment';
END;
$function$;

-- 7. Allow customer to look up own pending_payment order (for retry)
-- Already covered by existing "Users can view own orders" policy.

-- 8. Auto-cleanup: cancel pending_payment orders older than 30 minutes
CREATE OR REPLACE FUNCTION public.expire_stale_pending_payments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_count integer;
BEGIN
  UPDATE public.orders SET
    status = 'cancelled',
    cancelled_at = now(),
    cancel_reason = 'Payment not completed within 30 minutes',
    payment_status = 'expired'
  WHERE status = 'pending_payment'
    AND payment_initiated_at < now() - interval '30 minutes';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;