
-- Fix 1: Restrict driver UPDATE policy to prevent direct status='delivered' updates
-- Drop existing policy and recreate with WITH CHECK
DROP POLICY IF EXISTS "Drivers can update their assigned orders" ON public.orders;

CREATE POLICY "Drivers can update their assigned orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (auth.uid() = driver_id)
WITH CHECK (auth.uid() = driver_id AND status != 'delivered');

-- Fix 2: Create server-side order creation function that validates prices
CREATE OR REPLACE FUNCTION public.create_verified_order(
  p_items jsonb,
  p_restaurant_name text,
  p_customer_name text,
  p_customer_contact text,
  p_customer_address text,
  p_special_notes text DEFAULT '',
  p_tip numeric DEFAULT 0,
  p_delivery_code text DEFAULT '0000'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtotal numeric := 0;
  v_tax numeric;
  v_delivery_fee numeric := 55;
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

  -- Validate tip
  IF p_tip < 0 OR p_tip > 10000 THEN
    RAISE EXCEPTION 'Invalid tip amount';
  END IF;

  -- Resolve restaurant_id
  SELECT id INTO v_restaurant_id
  FROM restaurants
  WHERE name = p_restaurant_name AND is_active = true
  LIMIT 1;

  -- Calculate subtotal from authoritative menu_items prices
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

  -- Server-side calculations matching business rules
  v_tax := ROUND(v_subtotal * 0.05, 2);
  v_total := v_subtotal + v_tax + v_delivery_fee + p_tip;

  -- Insert the order
  INSERT INTO orders (
    user_id, customer_id, restaurant_id, restaurant,
    items, subtotal, tax, delivery_fee, tip, total,
    customer_name, customer_contact, customer_address,
    special_notes, delivery_code, status, payment_status
  ) VALUES (
    v_user_id, v_user_id, v_restaurant_id, p_restaurant_name,
    v_verified_items, v_subtotal, v_tax, v_delivery_fee, p_tip, v_total,
    p_customer_name, p_customer_contact, p_customer_address,
    p_special_notes, p_delivery_code, 'pending', 'pending'
  )
  RETURNING id, order_number INTO v_order_id, v_order_number;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'tax', v_tax,
    'delivery_fee', v_delivery_fee,
    'tip', p_tip,
    'total', v_total
  );
END;
$$;
