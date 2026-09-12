-- Server-only (edge functions with service role, and cron as postgres)
REVOKE EXECUTE ON FUNCTION public.confirm_online_payment(uuid,text,text,text,text,numeric,numeric,numeric,text,text,jsonb,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_online_payment_failed(uuid,text,text,text,text,jsonb,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_online_payment_refunded(uuid,text,text,numeric,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text,bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text,text,bigint,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dispatch_tick() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_cancel_stale_orders() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_cancel_stale_awaiting_orders() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.confirm_online_payment(uuid,text,text,text,text,numeric,numeric,numeric,text,text,jsonb,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_online_payment_failed(uuid,text,text,text,text,jsonb,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_online_payment_refunded(uuid,text,text,numeric,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text,text,bigint,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;
GRANT EXECUTE ON FUNCTION public.dispatch_tick() TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_cancel_stale_orders() TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_cancel_stale_awaiting_orders() TO service_role;

-- Signed-in only (internal role/ownership guards remain in force)
REVOKE EXECUTE ON FUNCTION public.dispatch_assign_next(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispatch_assign_next(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.spend_customer_credits(numeric,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_customer_credits(numeric,uuid,text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_customer_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_balance(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_driver_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_driver_balance(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.log_invalid_order_attempt(text,text,double precision,double precision,double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_invalid_order_attempt(text,text,double precision,double precision,double precision) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.claim_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_order(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.driver_accept_offer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_accept_offer(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.verify_and_complete_delivery(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_and_complete_delivery(uuid,text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.create_verified_order(jsonb,text,text,text,text,double precision,double precision,text,numeric,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_verified_order(jsonb,text,text,text,text,double precision,double precision,text,numeric,text,text,uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.apply_checkout_code(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_checkout_code(uuid,text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_or_create_referral_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_referral_code() TO authenticated, service_role;

-- Admin-only RPCs: signed-in only
REVOKE EXECUTE ON FUNCTION public.admin_approve_driver_request(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_approve_driver_request(uuid,text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_reject_driver_request(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reject_driver_request(uuid,text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_assign_driver(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_driver(uuid,uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_cancel_order(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cancel_order(uuid,text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_mark_bank_refund_paid(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mark_bank_refund_paid(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_set_driver_suspended(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_driver_suspended(uuid,boolean,text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_update_withdrawal(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_withdrawal(uuid,text,text,text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_dispatch_runs(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dispatch_runs(integer) TO authenticated, service_role;