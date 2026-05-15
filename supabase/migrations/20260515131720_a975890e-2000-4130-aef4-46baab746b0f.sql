CREATE OR REPLACE FUNCTION public.customer_cancel_pending_order(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_status text;
  v_owner uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT user_id, status INTO v_owner, v_status
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_owner IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_owner <> v_user THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF v_status NOT IN ('pending_payment','awaiting_restaurant') THEN
    RAISE EXCEPTION 'This order can no longer be cancelled' USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders
  SET status = 'cancelled',
      cancelled_at = now(),
      cancel_reason = 'Cancelled by customer before payment'
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.customer_cancel_pending_order(uuid) TO authenticated;