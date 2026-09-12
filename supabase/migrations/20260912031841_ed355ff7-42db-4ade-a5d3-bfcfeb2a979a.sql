
CREATE OR REPLACE FUNCTION public.customer_choose_refund(p_order_id uuid, p_method text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user UUID;
  v_order RECORD;
  v_amount NUMERIC;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_method NOT IN ('credits', 'bank') THEN
    RAISE EXCEPTION 'Invalid refund method';
  END IF;

  SELECT * INTO v_order FROM public.orders
  WHERE id = p_order_id AND user_id = v_user
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.refund_status <> 'pending' THEN
    RAISE EXCEPTION 'No pending refund for this order';
  END IF;

  IF v_order.payment_method <> 'online' THEN
    RAISE EXCEPTION 'Only online payments are refundable';
  END IF;

  IF v_order.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'This order was never charged, so there is nothing to refund';
  END IF;

  v_amount := v_order.refund_amount;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'No refundable amount';
  END IF;

  IF p_method = 'credits' THEN
    INSERT INTO public.customer_credits (user_id, balance)
    VALUES (v_user, v_amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = customer_credits.balance + v_amount, updated_at = now();

    INSERT INTO public.credit_transactions (user_id, amount, kind, order_id, note)
    VALUES (v_user, v_amount, 'refund', p_order_id, 'Refund credited to wallet for cancelled order');

    UPDATE public.orders SET
      refund_method = 'credits',
      refund_status = 'credited',
      refunded_at = now()
    WHERE id = p_order_id;

    RETURN jsonb_build_object('status', 'credited', 'amount', v_amount);
  ELSE
    UPDATE public.orders SET
      refund_method = 'bank',
      refund_status = 'bank_pending'
    WHERE id = p_order_id;

    RETURN jsonb_build_object('status', 'bank_pending', 'amount', v_amount);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_mark_bank_refund_paid(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = p_order_id AND refund_status = 'bank_pending' AND payment_status = 'paid'
  ) THEN
    RAISE EXCEPTION 'Order has no bank refund awaiting payout from a captured payment';
  END IF;

  UPDATE public.orders
  SET refund_status = 'bank_paid', refunded_at = now()
  WHERE id = p_order_id;
END;
$function$;
