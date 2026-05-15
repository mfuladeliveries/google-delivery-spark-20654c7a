CREATE OR REPLACE FUNCTION public.driver_request_dispatch()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_is_driver boolean;
  v_result jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = v_user AND role = 'driver')
    INTO v_is_driver;
  IF NOT v_is_driver THEN RAISE EXCEPTION 'Drivers only'; END IF;

  -- Light rate-limit so a misbehaving client can't hammer the dispatcher.
  IF NOT public.check_rate_limit(v_user::text, 'driver_request_dispatch', 6, 60) THEN
    RAISE EXCEPTION 'Too many requests' USING ERRCODE = '42901';
  END IF;

  SELECT public.dispatch_tick() INTO v_result;
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.driver_request_dispatch() TO authenticated;