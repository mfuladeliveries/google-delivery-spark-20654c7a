-- ============================================================================
-- QA AUDIT FIX MIGRATION (2026-09-12)
-- Bundles fixes for:
--   1) CRITICAL: wallet credits deducted from balance but never subtracted
--      from the amount actually charged to the customer (spend_customer_credits)
--   2) CRITICAL: paid orders skipped the restaurant confirm/prepare workflow
--      and were dispatched to drivers before the restaurant ever saw them
--      (confirm_online_payment + restaurant-side dashboard filter)
--   3) MEDIUM: order_messages CHECK constraint didn't allow the 'restaurant'
--      sender_role that RLS policies already permit
--   4) MEDIUM: dispatch-tick escalation targeted a status ('pending') that
--      no longer exists in the live flow -- fixed in the edge function, not here
--   5) LOW: admin_cancel_order only auto-flagged refunds for no_driver_found
--      cancellations; broadened to any paid order being cancelled
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FIX 1: spend_customer_credits must reduce the order's actual total, not
-- just record that credits were "applied". Previously credits_applied was
-- tracked but orders.total (the amount Yoco is told to charge) never
-- changed, so customers were charged the full price AND had their wallet
-- balance drained -- an effective double charge on every credit redemption.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spend_customer_credits(
  p_amount NUMERIC,
  p_order_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID;
  v_balance NUMERIC;
  v_spend NUMERIC;
  v_order RECORD;
  v_max_applicable NUMERIC;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN 0;
  END IF;

  -- Lock the order row so a concurrent payment/read can't race with this update.
  SELECT id, user_id, total, credits_applied, payment_status
    INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.user_id <> v_user THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  IF v_order.payment_status = 'paid' THEN
    RAISE EXCEPTION 'This order has already been paid for';
  END IF;

  SELECT balance INTO v_balance FROM public.customer_credits WHERE user_id = v_user FOR UPDATE;
  IF v_balance IS NULL OR v_balance <= 0 THEN
    RETURN 0;
  END IF;

  -- Never let credits reduce an order below zero, and never re-spend more
  -- than what's still owed on the order (covers double-calls / retries).
  v_max_applicable := GREATEST(0, v_order.total - COALESCE(v_order.credits_applied, 0));
  v_spend := LEAST(p_amount, v_balance, v_max_applicable);

  IF v_spend <= 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.customer_credits
  SET balance = balance - v_spend, updated_at = now()
  WHERE user_id = v_user;

  INSERT INTO public.credit_transactions (user_id, amount, kind, order_id, note)
  VALUES (v_user, -v_spend, 'spend', p_order_id, COALESCE(p_note, 'Applied to order'));

  -- Record the credit AND actually take it off the amount the customer owes,
  -- so the Yoco checkout (which reads orders.total directly) charges the
  -- correct, discounted amount.
  UPDATE public.orders
  SET credits_applied = COALESCE(credits_applied, 0) + v_spend,
      total = total - v_spend
  WHERE id = p_order_id AND user_id = v_user;

  RETURN v_spend;
END;
$$;

-- ----------------------------------------------------------------------------
-- FIX 2: confirm_online_payment should hand the order to the restaurant
-- (status 'confirmed') instead of jumping straight to 'ready' and
-- dispatching a driver before the kitchen has seen the order.
--
-- Note: supabase/functions/_shared/yoco.ts's runPostPaymentSideEffects()
-- ALREADY branches correctly on this -- it only calls dispatch_assign_next
-- when `new_status === 'ready'`, and otherwise sends a "restaurant, you have
-- a new order" push notification instead. It just never took that branch
-- because this function always hardcoded new_status to 'ready'. Changing
-- that one value is enough to route through the existing, correct logic --
-- no edge function changes needed.
--
-- Signature/columns kept byte-for-byte identical to the existing function so
-- this CREATE OR REPLACE truly replaces it rather than creating an overload.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_online_payment(
  p_order_id uuid,
  p_provider text,
  p_payment_id text,
  p_checkout_id text,
  p_reference text,
  p_amount_gross numeric,
  p_amount_fee numeric,
  p_amount_net numeric,
  p_payment_method text,
  p_currency text,
  p_raw_payload jsonb,
  p_source_ip text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_was_pending boolean := false;
  v_new_status text := 'confirmed'; -- was 'ready': restaurant must confirm/prepare first
BEGIN
  SELECT id, status, total, restaurant, restaurant_id, order_number, user_id
    INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF ABS(COALESCE(p_amount_gross, 0) - v_order.total) > 0.05 THEN
    INSERT INTO public.payment_transactions
      (order_id, provider, provider_txn_id, payment_status, amount_gross, amount_fee, amount_net,
       payment_method, raw_payload, signature_valid, source_ip)
    VALUES
      (p_order_id, COALESCE(p_provider,'yoco'), p_payment_id, 'amount_mismatch',
       p_amount_gross, p_amount_fee, p_amount_net, p_payment_method, p_raw_payload, true, p_source_ip);
    RAISE EXCEPTION 'Payment amount does not match order total';
  END IF;

  INSERT INTO public.payment_transactions
    (order_id, provider, provider_txn_id, payment_status, amount_gross, amount_fee, amount_net,
     payment_method, raw_payload, signature_valid, source_ip)
  VALUES
    (p_order_id, COALESCE(p_provider,'yoco'), p_payment_id, 'COMPLETE',
     p_amount_gross, p_amount_fee, p_amount_net, p_payment_method, p_raw_payload, true, p_source_ip);

  IF v_order.status = 'pending_payment' THEN
    UPDATE public.orders SET
      status = v_new_status,
      payment_status = 'paid',
      payment_provider = COALESCE(p_provider, 'yoco'),
      payment_provider_txn_id = p_payment_id,
      payment_checkout_id = COALESCE(p_checkout_id, payment_checkout_id),
      payment_reference = COALESCE(p_reference, payment_reference),
      payment_amount = p_amount_gross,
      payment_currency = COALESCE(p_currency, 'ZAR'),
      payment_completed_at = now(),
      paid_at = now()
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

-- ----------------------------------------------------------------------------
-- FIX 3: allow the 'restaurant' sender_role the RLS policies already grant.
-- Looks up the actual (possibly auto-generated) constraint name rather than
-- assuming Postgres's default naming, so this is safe to run regardless of
-- how the constraint was originally created.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT con.conname INTO v_conname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'order_messages'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%sender_role%'
  LIMIT 1;

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.order_messages DROP CONSTRAINT %I', v_conname);
  END IF;

  ALTER TABLE public.order_messages
    ADD CONSTRAINT order_messages_sender_role_check
    CHECK (sender_role IN ('customer', 'driver', 'restaurant'));
END $$;

-- ----------------------------------------------------------------------------
-- FIX 5: broaden admin_cancel_order's auto-refund flag to any paid order,
-- not just ones stuck in no_driver_found.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_cancel_order(p_order_id uuid, p_reason text DEFAULT 'Cancelled by admin'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current text;
  v_payment_status text;
  v_refund text;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT status, payment_status, refund_status
  INTO v_current, v_payment_status, v_refund
  FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_current IN ('delivered','cancelled','rejected') THEN
    RAISE EXCEPTION 'Order is already finalised (%).', v_current;
  END IF;

  UPDATE public.orders
  SET status = 'cancelled',
      driver_id = NULL,
      cancelled_at = now(),
      cancel_reason = COALESCE(p_reason, 'Cancelled by admin'),
      offered_to_driver_id = NULL,
      offer_expires_at = NULL,
      dispatch_phase = NULL,
      refund_status = CASE
        WHEN v_payment_status = 'paid' AND v_refund IS NULL
          THEN 'pending'
        ELSE refund_status
      END
  WHERE id = p_order_id;
END;
$function$;
