CREATE OR REPLACE FUNCTION public.dispatch_tick()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired RECORD;
  v_advanced integer := 0;
  v_advanced_orders uuid[] := ARRAY[]::uuid[];
  v_waiting RECORD;
  v_retried integer := 0;
  v_ndf RECORD;
  v_ndf_retried integer := 0;
BEGIN
  FOR v_expired IN
    SELECT id, offered_to_driver_id, dispatch_round FROM public.orders
    WHERE offer_expires_at IS NOT NULL
      AND offer_expires_at < now()
      AND status IN ('ready','no_driver_found')
      AND driver_id IS NULL
      AND offered_to_driver_id IS NOT NULL
  LOOP
    INSERT INTO public.order_dispatch_log(order_id, driver_id, round, event)
    VALUES (v_expired.id, v_expired.offered_to_driver_id, COALESCE(v_expired.dispatch_round, 1), 'timeout');
    PERFORM public.dispatch_assign_next(v_expired.id);
    v_advanced := v_advanced + 1;
    v_advanced_orders := array_append(v_advanced_orders, v_expired.id);
  END LOOP;

  -- Orders waiting for a driver, INCLUDING ones that were never dispatched at all
  -- (dispatch_phase IS NULL, e.g. status set to ready by payment confirmation
  -- without a client-side dispatch call).
  FOR v_waiting IN
    SELECT id FROM public.orders
    WHERE status = 'ready'
      AND driver_id IS NULL
      AND (dispatch_phase = 'waiting' OR dispatch_phase IS NULL)
      AND offered_to_driver_id IS NULL
  LOOP
    PERFORM public.dispatch_assign_next(v_waiting.id);
    v_retried := v_retried + 1;
    v_advanced_orders := array_append(v_advanced_orders, v_waiting.id);
  END LOOP;

  FOR v_ndf IN
    SELECT id FROM public.orders
    WHERE status = 'no_driver_found'
      AND driver_id IS NULL
      AND (offered_to_driver_id IS NULL OR COALESCE(offer_expires_at, now()) <= now())
  LOOP
    PERFORM public.dispatch_assign_next(v_ndf.id);
    v_ndf_retried := v_ndf_retried + 1;
    v_advanced_orders := array_append(v_advanced_orders, v_ndf.id);
  END LOOP;

  RETURN jsonb_build_object(
    'advanced', v_advanced,
    'advanced_orders', v_advanced_orders,
    'retried', v_retried,
    'ndf_retried', v_ndf_retried
  );
END;
$$;