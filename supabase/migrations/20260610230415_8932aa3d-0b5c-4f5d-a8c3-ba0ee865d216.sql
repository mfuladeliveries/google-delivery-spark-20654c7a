-- =========================================================
-- Customer favourites
-- =========================================================
CREATE TABLE public.customer_favourites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, restaurant_id)
);

GRANT SELECT, INSERT, DELETE ON public.customer_favourites TO authenticated;
GRANT ALL ON public.customer_favourites TO service_role;

ALTER TABLE public.customer_favourites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers manage their own favourites"
  ON public.customer_favourites
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX customer_favourites_user_idx
  ON public.customer_favourites(user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_favourites;

-- =========================================================
-- Customer self-serve cancel for early-stage orders (<5 min)
-- =========================================================
CREATE OR REPLACE FUNCTION public.customer_cancel_recent_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_order RECORD;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, user_id, status, created_at, driver_id
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

  IF v_order.driver_id IS NOT NULL THEN
    RAISE EXCEPTION 'A driver is already on the way — please contact support' USING ERRCODE = '22023';
  END IF;

  IF v_order.created_at < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'Cancellation window has passed (5 minutes)' USING ERRCODE = '22023';
  END IF;

  IF v_order.status NOT IN (
    'pending_payment','awaiting_restaurant','pending','confirmed','preparing','ready'
  ) THEN
    RAISE EXCEPTION 'This order can no longer be cancelled (status: %)', v_order.status USING ERRCODE = '22023';
  END IF;

  -- The mark_refund_pending_on_cancel trigger handles refund_status for online orders.
  UPDATE public.orders
  SET status = 'cancelled',
      cancelled_at = now(),
      cancel_reason = 'Cancelled by customer'
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.customer_cancel_recent_order(uuid) TO authenticated;