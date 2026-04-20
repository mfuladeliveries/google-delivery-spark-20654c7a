-- 1. New timestamp + reason columns on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS picking_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS picked_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

-- 2. Replace driver_update_order to support full lifecycle with timestamps
CREATE OR REPLACE FUNCTION public.driver_update_order(
  p_order_id uuid,
  p_status text,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock the row & read current status
  SELECT status INTO v_current
  FROM public.orders
  WHERE id = p_order_id AND driver_id = auth.uid()
  FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Order not found or not assigned to you';
  END IF;

  -- Allow GPS-only update without status change
  IF p_status IS NOT NULL THEN
    -- Validate forward-only transitions
    IF NOT (
      (v_current = 'driver_assigned' AND p_status = 'picking_up') OR
      (v_current = 'picking_up' AND p_status = 'arrived_at_restaurant') OR
      (v_current = 'arrived_at_restaurant' AND p_status = 'out_for_delivery') OR
      -- backwards-compat: allow legacy direct picking_up -> out_for_delivery
      (v_current = 'picking_up' AND p_status = 'out_for_delivery')
    ) THEN
      RAISE EXCEPTION 'Invalid status transition: % -> %', v_current, p_status;
    END IF;
  END IF;

  UPDATE public.orders SET
    status = COALESCE(p_status, status),
    driver_lat = COALESCE(p_lat, driver_lat),
    driver_lng = COALESCE(p_lng, driver_lng),
    driver_location_updated_at = now(),
    picking_up_at = CASE WHEN p_status = 'picking_up' AND picking_up_at IS NULL THEN now() ELSE picking_up_at END,
    arrived_at = CASE WHEN p_status = 'arrived_at_restaurant' AND arrived_at IS NULL THEN now() ELSE arrived_at END,
    picked_up_at = CASE WHEN p_status = 'out_for_delivery' AND picked_up_at IS NULL THEN now() ELSE picked_up_at END
  WHERE id = p_order_id
    AND driver_id = auth.uid();
END;
$$;

-- 3. Update claim_order to also stamp accepted_at
CREATE OR REPLACE FUNCTION public.claim_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_driver_id uuid;
BEGIN
  v_driver_id := auth.uid();
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM driver_profiles
    WHERE user_id = v_driver_id AND is_online = true
  ) THEN
    RAISE EXCEPTION 'Driver must be online to accept orders';
  END IF;

  IF EXISTS (
    SELECT 1 FROM orders
    WHERE driver_id = v_driver_id
      AND status IN ('driver_assigned', 'picking_up', 'arrived_at_restaurant', 'out_for_delivery')
  ) THEN
    RAISE EXCEPTION 'You already have an active delivery';
  END IF;

  UPDATE orders
  SET driver_id = v_driver_id,
      status = 'driver_assigned',
      accepted_at = now()
  WHERE id = p_order_id
    AND status = 'ready'
    AND driver_id IS NULL;

  RETURN FOUND;
END;
$$;

-- 4. Update driver_cancel_order to allow cancel from arrived_at_restaurant and store reason/time
CREATE OR REPLACE FUNCTION public.driver_cancel_order(
  p_order_id uuid,
  p_reason text DEFAULT 'Item not available at the restaurant'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.orders
  SET status = 'cancelled',
      cancelled_at = now(),
      cancel_reason = COALESCE(p_reason, 'Item not available at the restaurant'),
      special_notes = COALESCE(NULLIF(special_notes, ''), '') ||
        CASE WHEN COALESCE(special_notes, '') = '' THEN '' ELSE E'\n' END ||
        '[Cancelled by driver] ' || COALESCE(p_reason, 'Item not available at the restaurant')
  WHERE id = p_order_id
    AND driver_id = auth.uid()
    AND status IN ('driver_assigned', 'picking_up', 'arrived_at_restaurant');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found, not assigned to you, or no longer cancellable';
  END IF;
END;
$$;

-- 5. Include arrived_at_restaurant in the stale-orders auto-cancel set + stamp cancelled_at
CREATE OR REPLACE FUNCTION public.auto_cancel_stale_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.orders
    SET status = 'cancelled',
        driver_id = NULL,
        cancelled_at = COALESCE(cancelled_at, now()),
        cancel_reason = COALESCE(cancel_reason, 'Auto-cancelled: not completed within 12 hours')
    WHERE status IN (
      'pending', 'confirmed', 'preparing', 'ready',
      'driver_assigned', 'picking_up', 'arrived_at_restaurant', 'out_for_delivery'
    )
      AND created_at < (now() - interval '12 hours')
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;