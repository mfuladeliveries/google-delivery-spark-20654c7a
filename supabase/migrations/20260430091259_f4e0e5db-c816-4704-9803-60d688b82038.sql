REVOKE ALL ON FUNCTION public.confirm_payfast_payment(uuid, text, numeric, numeric, numeric, text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_payfast_payment_failed(uuid, text, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_stale_pending_payments() FROM PUBLIC, anon, authenticated;