-- Server-only: payment capture / refund / failure marking (called by edge functions with service role)
REVOKE EXECUTE ON FUNCTION public.confirm_online_payment(uuid,text,text,text,text,numeric,numeric,numeric,text,text,jsonb,text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_online_payment_failed(uuid,text,text,text,text,jsonb,text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_online_payment_refunded(uuid,text,text,numeric,jsonb) FROM anon, authenticated;

-- Server-only: email queue plumbing
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text,jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text,integer,integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text,bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text,text,bigint,jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated;

-- Server-only: scheduled maintenance / dispatch sweep
REVOKE EXECUTE ON FUNCTION public.dispatch_tick() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_cancel_stale_orders() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_cancel_stale_awaiting_orders() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_invalid_order_attempt(text,text,double precision,double precision,double precision) FROM anon;

-- Signed-in only (guards inside already check role/ownership)
REVOKE EXECUTE ON FUNCTION public.dispatch_assign_next(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.spend_customer_credits(numeric,uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_customer_balance(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_driver_balance(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_approve_driver_request(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_reject_driver_request(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_assign_driver(uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_cancel_order(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_mark_bank_refund_paid(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_driver_suspended(uuid,boolean,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_withdrawal(uuid,text,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_dispatch_runs(integer) FROM anon;