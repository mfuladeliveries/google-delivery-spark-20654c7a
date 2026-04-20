-- Smart dispatch system: targeted offer chain with broadcast fallback

-- 1. Add dispatch tracking columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS offered_to_driver_id uuid,
  ADD COLUMN IF NOT EXISTS offer_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_phase text,
  ADD COLUMN IF NOT EXISTS dispatch_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS missed_by_driver_ids uuid[] DEFAULT ARRAY[]::uuid[];

CREATE INDEX IF NOT EXISTS idx_orders_dispatch_phase ON public.orders(dispatch_phase) WHERE dispatch_phase IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_offered_driver ON public.orders(offered_to_driver_id) WHERE offered_to_driver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_offer_expires ON public.orders(offer_expires_at) WHERE offer_expires_at IS NOT NULL;

-- 2. Pick the next driver: most recently active online driver not already missed
CREATE OR REPLACE FUNCTION public.dispatch_assign_next(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_next_driver uuid;
  v_previous_driver uuid;
  v_new_phase text;
  v_offer_seconds integer := 20;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status NOT IN ('ready') OR v_order.driver_id IS NOT NULL THEN
    RETURN jsonb_build_object('phase', v_order.dispatch_phase, 'reason', 'not_dispatchable');
  END IF;

  v_previous_driver := v_order.offered_to_driver_id;

  -- Mark previous offeree as missed (if any)
  IF v_previous_driver IS NOT NULL THEN
    UPDATE public.orders
    SET missed_by_driver_ids = array_append(COALESCE(missed_by_driver_ids, ARRAY[]::uuid[]), v_previous_driver)
    WHERE id = p_order_id
      AND NOT (v_previous_driver = ANY(COALESCE(missed_by_driver_ids, ARRAY[]::uuid[])));
    v_order.missed_by_driver_ids := array_append(COALESCE(v_order.missed_by_driver_ids, ARRAY[]::uuid[]), v_previous_driver);
  END IF;

  -- Determine next phase
  IF v_order.dispatch_phase IS NULL THEN
    v_new_phase := 'offer_a';
  ELSIF v_order.dispatch_phase = 'offer_a' THEN
    v_new_phase := 'offer_b';
  ELSE
    -- Already exhausted A & B → move to waiting
    v_new_phase := 'waiting';
  END IF;

  -- If still in offer phase, pick next driver (most recently active, not missed, not on active job)
  IF v_new_phase IN ('offer_a', 'offer_b') THEN
    SELECT dp.user_id INTO v_next_driver
    FROM public.driver_profiles dp
    WHERE dp.is_online = true
      AND NOT (dp.user_id = ANY(COALESCE(v_order.missed_by_driver_ids, ARRAY[]::uuid[])))
      AND NOT EXISTS (
        SELECT 1 FROM public.orders o2
        WHERE o2.driver_id = dp.user_id
          AND o2.status IN ('driver_assigned','picking_up','arrived_at_restaurant','out_for_delivery')
      )
    ORDER BY dp.location_updated_at DESC NULLS LAST, dp.updated_at DESC
    LIMIT 1;

    IF v_next_driver IS NULL THEN
      -- No eligible driver → go straight to waiting
      v_new_phase := 'waiting';
    END IF;
  END IF;

  IF v_new_phase IN ('offer_a','offer_b') THEN
    UPDATE public.orders SET
      offered_to_driver_id = v_next_driver,
      offer_expires_at = now() + make_interval(secs => v_offer_seconds),
      dispatch_phase = v_new_phase,
      dispatch_started_at = COALESCE(dispatch_started_at, now())
    WHERE id = p_order_id;
  ELSE
    UPDATE public.orders SET
      offered_to_driver_id = NULL,
      offer_expires_at = NULL,
      dispatch_phase = 'waiting',
      dispatch_started_at = COALESCE(dispatch_started_at, now())
    WHERE id = p_order_id;
  END IF;

  RETURN jsonb_build_object(
    'phase', v_new_phase,
    'offered_to', v_next_driver,
    'previous_driver', v_previous_driver
  );
END;
$$;

-- 3. Driver accepts a targeted offer
CREATE OR REPLACE FUNCTION public.driver_accept_offer(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver uuid := auth.uid();
BEGIN
  IF v_driver IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE driver_id = v_driver
      AND status IN ('driver_assigned','picking_up','arrived_at_restaurant','out_for_delivery')
  ) THEN
    RAISE EXCEPTION 'You already have an active delivery';
  END IF;

  UPDATE public.orders SET
    driver_id = v_driver,
    status = 'driver_assigned',
    accepted_at = now(),
    offered_to_driver_id = NULL,
    offer_expires_at = NULL,
    dispatch_phase = NULL
  WHERE id = p_order_id
    AND offered_to_driver_id = v_driver
    AND offer_expires_at > now()
    AND status = 'ready'
    AND driver_id IS NULL;

  RETURN FOUND;
END;
$$;

-- 4. Driver declines / dismisses a targeted offer (advance chain immediately)
CREATE OR REPLACE FUNCTION public.driver_decline_offer(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver uuid := auth.uid();
BEGIN
  IF v_driver IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Force expiry so dispatch_assign_next picks the next driver
  UPDATE public.orders SET
    offer_expires_at = now() - interval '1 second'
  WHERE id = p_order_id
    AND offered_to_driver_id = v_driver
    AND status = 'ready';

  -- Immediately advance the chain
  PERFORM public.dispatch_assign_next(p_order_id);
END;
$$;

-- 5. Update existing claim_order so drivers can only claim broadcast-phase orders
CREATE OR REPLACE FUNCTION public.claim_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id uuid;
BEGIN
  v_driver_id := auth.uid();
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.driver_profiles
    WHERE user_id = v_driver_id AND is_online = true
  ) THEN
    RAISE EXCEPTION 'Driver must be online to accept orders';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE driver_id = v_driver_id
      AND status IN ('driver_assigned', 'picking_up', 'arrived_at_restaurant', 'out_for_delivery')
  ) THEN
    RAISE EXCEPTION 'You already have an active delivery';
  END IF;

  UPDATE public.orders
  SET driver_id = v_driver_id,
      status = 'driver_assigned',
      accepted_at = now(),
      offered_to_driver_id = NULL,
      offer_expires_at = NULL,
      dispatch_phase = NULL
  WHERE id = p_order_id
    AND status = 'ready'
    AND driver_id IS NULL
    AND dispatch_phase = 'broadcast';

  RETURN FOUND;
END;
$$;

-- 6. Update RLS: drivers see (a) their assigned orders, (b) targeted offers to them, (c) broadcast-phase orders
DROP POLICY IF EXISTS "Drivers can view ready unassigned orders" ON public.orders;

CREATE POLICY "Drivers can view targeted offers"
ON public.orders
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'driver'::app_role)
  AND status = 'ready'
  AND driver_id IS NULL
  AND (
    offered_to_driver_id = auth.uid()
    OR dispatch_phase = 'broadcast'
  )
);

-- 7. Tick function: expire stale offers + flip waiting orders to broadcast after 5 min
CREATE OR REPLACE FUNCTION public.dispatch_tick()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired RECORD;
  v_advanced integer := 0;
  v_broadcasted integer := 0;
  v_broadcast_orders uuid[] := ARRAY[]::uuid[];
  v_advanced_orders uuid[] := ARRAY[]::uuid[];
BEGIN
  -- Advance expired offers
  FOR v_expired IN
    SELECT id FROM public.orders
    WHERE dispatch_phase IN ('offer_a','offer_b')
      AND offer_expires_at IS NOT NULL
      AND offer_expires_at < now()
      AND status = 'ready'
      AND driver_id IS NULL
  LOOP
    PERFORM public.dispatch_assign_next(v_expired.id);
    v_advanced := v_advanced + 1;
    v_advanced_orders := array_append(v_advanced_orders, v_expired.id);
  END LOOP;

  -- Flip 5-min-old waiting orders to broadcast
  WITH flipped AS (
    UPDATE public.orders SET dispatch_phase = 'broadcast'
    WHERE dispatch_phase = 'waiting'
      AND dispatch_started_at < now() - interval '5 minutes'
      AND status = 'ready'
      AND driver_id IS NULL
    RETURNING id
  )
  SELECT count(*), array_agg(id) INTO v_broadcasted, v_broadcast_orders FROM flipped;

  RETURN jsonb_build_object(
    'advanced', v_advanced,
    'advanced_orders', v_advanced_orders,
    'broadcasted', COALESCE(v_broadcasted, 0),
    'broadcast_orders', COALESCE(v_broadcast_orders, ARRAY[]::uuid[])
  );
END;
$$;