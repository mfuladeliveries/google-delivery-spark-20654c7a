
-- Remove the auto-assign driver trigger
DROP TRIGGER IF EXISTS trg_auto_assign_driver ON public.orders;

-- Drop the function
DROP FUNCTION IF EXISTS public.auto_assign_driver();

-- Create atomic claim_order RPC
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
      AND status IN ('driver_assigned', 'picking_up', 'out_for_delivery')
  ) THEN
    RAISE EXCEPTION 'You already have an active delivery';
  END IF;

  UPDATE orders
  SET driver_id = v_driver_id,
      status = 'driver_assigned'
  WHERE id = p_order_id
    AND status = 'ready'
    AND driver_id IS NULL;

  RETURN FOUND;
END;
$$;
