-- 1. Block duplicate per-order wallet entries
CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_unique_per_order
  ON public.credit_transactions (user_id, kind, order_id)
  WHERE order_id IS NOT NULL AND kind IN ('spend','refund','referral','reversal');

-- 2. Idempotent credit spending
CREATE OR REPLACE FUNCTION public.spend_customer_credits(p_amount numeric, p_order_id uuid, p_note text DEFAULT NULL::text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user UUID;
  v_balance NUMERIC;
  v_spend NUMERIC;
  v_order RECORD;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN 0;
  END IF;

  SELECT id, user_id, status, credits_applied
    INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.user_id <> v_user THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF v_order.status IN ('cancelled','rejected','delivered') THEN
    RAISE EXCEPTION 'This order can no longer use wallet credit';
  END IF;

  -- Idempotency: credits already applied to this order, do not charge again
  IF COALESCE(v_order.credits_applied, 0) > 0
     OR EXISTS (
       SELECT 1 FROM public.credit_transactions
       WHERE user_id = v_user AND order_id = p_order_id AND kind = 'spend'
     ) THEN
    RETURN COALESCE(v_order.credits_applied, 0);
  END IF;

  SELECT balance INTO v_balance FROM public.customer_credits WHERE user_id = v_user FOR UPDATE;
  IF v_balance IS NULL OR v_balance <= 0 THEN
    RETURN 0;
  END IF;

  v_spend := LEAST(p_amount, v_balance);

  UPDATE public.customer_credits
  SET balance = balance - v_spend, updated_at = now()
  WHERE user_id = v_user;

  INSERT INTO public.credit_transactions (user_id, amount, kind, order_id, note)
  VALUES (v_user, -v_spend, 'spend', p_order_id, COALESCE(p_note, 'Applied to order'));

  UPDATE public.orders SET credits_applied = v_spend
  WHERE id = p_order_id AND user_id = v_user;

  RETURN v_spend;
END;
$function$;

-- 3. Return wallet credit when an order that used it is cancelled/rejected
CREATE OR REPLACE FUNCTION public.restore_credits_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_amount NUMERIC;
BEGIN
  IF NEW.status IN ('cancelled','rejected')
     AND OLD.status IS DISTINCT FROM NEW.status
     AND COALESCE(NEW.credits_applied, 0) > 0 THEN

    v_amount := NEW.credits_applied;

    IF NOT EXISTS (
      SELECT 1 FROM public.credit_transactions
      WHERE user_id = NEW.user_id AND order_id = NEW.id AND kind = 'reversal'
    ) THEN
      INSERT INTO public.customer_credits (user_id, balance)
      VALUES (NEW.user_id, v_amount)
      ON CONFLICT (user_id) DO UPDATE
        SET balance = customer_credits.balance + EXCLUDED.balance, updated_at = now();

      INSERT INTO public.credit_transactions (user_id, amount, kind, order_id, note)
      VALUES (NEW.user_id, v_amount, 'reversal', NEW.id, 'Wallet credit returned for cancelled order');
    END IF;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_restore_credits_on_cancel ON public.orders;
CREATE TRIGGER trg_restore_credits_on_cancel
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.restore_credits_on_cancel();
