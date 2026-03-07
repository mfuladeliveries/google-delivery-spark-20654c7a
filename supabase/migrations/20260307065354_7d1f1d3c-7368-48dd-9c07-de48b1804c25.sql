
-- 1. Add pin_attempts column to orders for brute-force protection
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pin_attempts integer NOT NULL DEFAULT 0;

-- 2. Update verify_and_complete_delivery to enforce attempt limits
CREATE OR REPLACE FUNCTION public.verify_and_complete_delivery(p_order_id uuid, p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_hash text;
  v_attempts integer;
BEGIN
  -- Check current attempts
  SELECT pin_attempts INTO v_attempts
  FROM orders
  WHERE id = p_order_id
    AND driver_id = auth.uid()
    AND status = 'out_for_delivery';

  IF v_attempts IS NULL THEN
    RAISE EXCEPTION 'Order not found or not assigned to you';
  END IF;

  IF v_attempts >= 5 THEN
    RAISE EXCEPTION 'Too many failed attempts. Contact support.';
  END IF;

  v_hash := encode(extensions.digest(p_code, 'sha256'), 'hex');

  -- Try to verify
  UPDATE orders SET status = 'delivered', delivered_at = now()
  WHERE id = p_order_id
    AND driver_id = auth.uid()
    AND delivery_code_hash = v_hash
    AND status = 'out_for_delivery';

  IF FOUND THEN
    RETURN true;
  ELSE
    -- Increment failed attempts
    UPDATE orders SET pin_attempts = pin_attempts + 1
    WHERE id = p_order_id
      AND driver_id = auth.uid()
      AND status = 'out_for_delivery';
    RETURN false;
  END IF;
END;
$$;

-- 3. Create driver_update_order RPC to replace broad UPDATE policy
CREATE OR REPLACE FUNCTION public.driver_update_order(p_order_id uuid, p_status text, p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow safe status transitions
  IF p_status IS NOT NULL AND p_status NOT IN ('picking_up', 'out_for_delivery') THEN
    RAISE EXCEPTION 'Invalid status transition for driver';
  END IF;

  UPDATE orders SET
    status = COALESCE(p_status, status),
    driver_lat = COALESCE(p_lat, driver_lat),
    driver_lng = COALESCE(p_lng, driver_lng),
    driver_location_updated_at = now()
  WHERE id = p_order_id
    AND driver_id = auth.uid()
    AND status NOT IN ('delivered', 'cancelled');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or not assigned to you';
  END IF;
END;
$$;

-- 4. Drop the overpermissive driver update policy
DROP POLICY IF EXISTS "Drivers can update their assigned orders" ON public.orders;
