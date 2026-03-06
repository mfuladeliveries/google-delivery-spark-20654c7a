
CREATE OR REPLACE FUNCTION public.verify_and_complete_delivery(p_order_id uuid, p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE orders SET status = 'delivered'
  WHERE id = p_order_id
    AND driver_id = auth.uid()
    AND delivery_code = p_code
    AND status = 'out_for_delivery';
  RETURN FOUND;
END;
$$;
