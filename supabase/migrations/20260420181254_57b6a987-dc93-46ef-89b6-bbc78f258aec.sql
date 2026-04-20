-- Add admin-readable plaintext delivery code (the hashed code is keep for verification)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS admin_delivery_code text;

-- Update create_verified_order to also store the plaintext code in admin_delivery_code
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
SET search_path TO 'public'
AS $function$
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
$function$;

-- Backfill admin_delivery_code from delivery_code where still present (shouldn't be many; trigger nulls it)
UPDATE public.orders
SET admin_delivery_code = delivery_code
WHERE admin_delivery_code IS NULL
  AND delivery_code IS NOT NULL
  AND delivery_code <> '';

-- Admin cancel order RPC (handles refund flagging via existing trigger)
CREATE OR REPLACE FUNCTION public.admin_cancel_order(p_order_id uuid, p_reason text DEFAULT 'Cancelled by admin'::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current text;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT status INTO v_current FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_current IN ('delivered','cancelled','rejected') THEN
    RAISE EXCEPTION 'Order is already finalised (%).', v_current;
  END IF;

  UPDATE public.orders
  SET status = 'cancelled',
      driver_id = NULL,
      cancelled_at = now(),
      cancel_reason = COALESCE(p_reason, 'Cancelled by admin'),
      offered_to_driver_id = NULL,
      offer_expires_at = NULL,
      dispatch_phase = NULL
  WHERE id = p_order_id;
END;
$function$;