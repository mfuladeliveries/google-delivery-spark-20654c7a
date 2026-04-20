
-- 1. Customer wallet balance table
CREATE TABLE public.customer_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  balance NUMERIC NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own credits"
  ON public.customer_credits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all credits"
  ON public.customer_credits FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- No direct insert/update/delete — handled via security definer functions only

CREATE TRIGGER update_customer_credits_updated_at
  BEFORE UPDATE ON public.customer_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. Credit transactions ledger
CREATE TABLE public.credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL, -- positive = credit added, negative = spent
  kind TEXT NOT NULL CHECK (kind IN ('refund', 'spend', 'adjustment', 'reversal')),
  order_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_tx_user ON public.credit_transactions(user_id, created_at DESC);
CREATE INDEX idx_credit_tx_order ON public.credit_transactions(order_id);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own transactions"
  ON public.credit_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all transactions"
  ON public.credit_transactions FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));


-- 3. Extend orders table with refund fields
ALTER TABLE public.orders
  ADD COLUMN refund_method TEXT CHECK (refund_method IN ('credits', 'bank')),
  ADD COLUMN refund_status TEXT CHECK (refund_status IN ('pending', 'credited', 'bank_pending', 'bank_paid')),
  ADD COLUMN refund_amount NUMERIC,
  ADD COLUMN refunded_at TIMESTAMPTZ,
  ADD COLUMN credits_applied NUMERIC NOT NULL DEFAULT 0 CHECK (credits_applied >= 0);

-- Auto-mark online-paid orders as refund-pending when cancelled
CREATE OR REPLACE FUNCTION public.mark_refund_pending_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'rejected')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.payment_method = 'online'
     AND NEW.refund_status IS NULL
     AND NEW.total > 0 THEN
    NEW.refund_status := 'pending';
    NEW.refund_amount := NEW.total - COALESCE(NEW.credits_applied, 0);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_mark_refund_pending
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.mark_refund_pending_on_cancel();


-- 4. Get customer wallet balance
CREATE OR REPLACE FUNCTION public.get_customer_balance(p_user_id UUID DEFAULT NULL)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target UUID;
  v_balance NUMERIC;
BEGIN
  v_target := COALESCE(p_user_id, auth.uid());
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_target <> auth.uid() AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT COALESCE(balance, 0) INTO v_balance
  FROM public.customer_credits WHERE user_id = v_target;

  RETURN COALESCE(v_balance, 0);
END;
$$;


-- 5. Customer chooses refund method on a cancelled order
CREATE OR REPLACE FUNCTION public.customer_choose_refund(
  p_order_id UUID,
  p_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  v_amount := v_order.refund_amount;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'No refundable amount';
  END IF;

  IF p_method = 'credits' THEN
    -- Top up wallet immediately
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
    -- Queue for manual bank payout
    UPDATE public.orders SET
      refund_method = 'bank',
      refund_status = 'bank_pending'
    WHERE id = p_order_id;

    RETURN jsonb_build_object('status', 'bank_pending', 'amount', v_amount);
  END IF;
END;
$$;


-- 6. Admin marks bank refund as paid
CREATE OR REPLACE FUNCTION public.admin_mark_bank_refund_paid(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.refund_status <> 'bank_pending' THEN
    RAISE EXCEPTION 'Order is not awaiting a bank refund';
  END IF;

  UPDATE public.orders SET
    refund_status = 'bank_paid',
    refunded_at = now()
  WHERE id = p_order_id;
END;
$$;


-- 7. Apply wallet credits to an order (called at checkout before creating order)
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
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN 0;
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

  -- Record on the order
  UPDATE public.orders SET credits_applied = COALESCE(credits_applied, 0) + v_spend
  WHERE id = p_order_id AND user_id = v_user;

  RETURN v_spend;
END;
$$;
