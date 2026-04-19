-- Function to auto-cancel orders not completed within 12 hours
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
        driver_id = NULL
    WHERE status IN (
      'pending', 'confirmed', 'preparing', 'ready',
      'driver_assigned', 'picking_up', 'out_for_delivery'
    )
      AND created_at < (now() - interval '12 hours')
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;