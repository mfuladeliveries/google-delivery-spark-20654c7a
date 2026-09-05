CREATE OR REPLACE FUNCTION public.expire_stale_pending_payments()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count integer;
BEGIN
  UPDATE public.orders SET
    status = 'cancelled',
    cancelled_at = now(),
    cancel_reason = 'Payment not completed within 30 minutes',
    payment_status = 'expired'
  WHERE status = 'pending_payment'
    AND COALESCE(payment_initiated_at, created_at) < now() - interval '30 minutes';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;