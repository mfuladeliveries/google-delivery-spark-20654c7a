
-- 1) Restrict app_settings public read to known-safe keys
DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;
CREATE POLICY "Public can read whitelisted app settings"
  ON public.app_settings
  FOR SELECT
  TO anon, authenticated
  USING (key IN ('about_page'));

CREATE POLICY "Admins can read all app settings"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2) Remove sensitive tables from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.driver_profiles;
ALTER PUBLICATION supabase_realtime DROP TABLE public.app_settings;

-- 3) Lock down EXECUTE on sensitive SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.dispatch_tick() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dispatch_assign_next(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_cancel_stale_orders() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_cancel_stale_awaiting_orders() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_stale_pending_payments() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_payfast_payment(uuid, text, numeric, numeric, numeric, text, jsonb, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_payfast_payment_failed(uuid, text, text, text, jsonb, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_invalid_order_attempt(text, text, double precision, double precision, double precision) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_cancel_order(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_withdrawal(uuid, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_reject_driver_request(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_mark_bank_refund_paid(uuid) FROM anon;
