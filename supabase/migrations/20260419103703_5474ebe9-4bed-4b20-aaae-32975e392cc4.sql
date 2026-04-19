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
      special_notes = COALESCE(NULLIF(special_notes, ''), '') ||
        CASE WHEN COALESCE(special_notes, '') = '' THEN '' ELSE E'\n' END ||
        '[Cancelled by driver] ' || COALESCE(p_reason, 'Item not available at the restaurant')
  WHERE id = p_order_id
    AND driver_id = auth.uid()
    AND status IN ('driver_assigned', 'picking_up');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found, not assigned to you, or no longer cancellable';
  END IF;
END;
$$;