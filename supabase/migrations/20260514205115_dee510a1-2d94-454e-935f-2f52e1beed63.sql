CREATE OR REPLACE FUNCTION public.confirm_payfast_payment(
  p_order_id uuid,
  p_provider_txn_id text,
  p_amount_gross numeric,
  p_amount_fee numeric,
  p_amount_net numeric,
  p_payment_method text,
  p_raw_payload jsonb,
  p_source_ip text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_was_pending boolean := false;
  v_new_status text := 'ready';
BEGIN
  SELECT id, status, total, restaurant, restaurant_id, order_number, user_id
    INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF ABS(COALESCE(p_amount_gross,0) - v_order.total) > 0.05 THEN
    INSERT INTO public.payment_transactions
      (order_id, provider, provider_txn_id, payment_status, amount_gross, amount_fee, amount_net,
       payment_method, raw_payload, signature_valid, source_ip)
    VALUES
      (p_order_id, 'payfast', p_provider_txn_id, 'amount_mismatch',
       p_amount_gross, p_amount_fee, p_amount_net, p_payment_method, p_raw_payload, true, p_source_ip);
    RAISE EXCEPTION 'Payment amount does not match order total';
  END IF;

  INSERT INTO public.payment_transactions
    (order_id, provider, provider_txn_id, payment_status, amount_gross, amount_fee, amount_net,
     payment_method, raw_payload, signature_valid, source_ip)
  VALUES
    (p_order_id, 'payfast', p_provider_txn_id, 'COMPLETE',
     p_amount_gross, p_amount_fee, p_amount_net, p_payment_method, p_raw_payload, true, p_source_ip);

  -- Approval (restaurant / admin) already happened BEFORE payment was allowed,
  -- so once payment is captured the order is always ready for driver dispatch.
  IF v_order.status = 'pending_payment' THEN
    UPDATE public.orders SET
      status = v_new_status,
      payment_status = 'paid',
      payment_provider_txn_id = p_provider_txn_id,
      payment_completed_at = now()
    WHERE id = p_order_id;
    v_was_pending := true;
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'restaurant', v_order.restaurant,
    'total', v_order.total,
    'user_id', v_order.user_id,
    'newly_paid', v_was_pending,
    'new_status', v_new_status,
    'requires_confirmation', false
  );
END;
$function$;