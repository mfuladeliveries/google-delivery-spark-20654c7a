CREATE OR REPLACE FUNCTION public.customer_cancel_pending_order(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_order public.orders;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF v_order.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF v_order.user_id IS DISTINCT FROM v_user THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE='42501'; END IF;
 IF v_order.payment_status NOT IN ('pending','pending_payment','failed','cancelled','expired','unpaid') OR v_order.payment_status IS NULL THEN
  RAISE EXCEPTION 'Payment Successful – Order Cannot Be Cancelled. Only a Mfula administrator can approve an exception.' USING ERRCODE='42501';
 END IF;
 IF v_order.status IN ('cancelled','rejected','delivered') THEN RAISE EXCEPTION 'This order is already finalised' USING ERRCODE='22023'; END IF;
 UPDATE public.orders SET status='cancelled', cancelled_at=now(), cancel_reason='Cancelled by customer before payment', offered_to_driver_id=NULL, offer_expires_at=NULL, dispatch_phase=NULL WHERE id=p_order_id;
 RETURN jsonb_build_object('ok',true,'order_id',p_order_id);
END; $$;
REVOKE ALL ON FUNCTION public.customer_cancel_pending_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_cancel_pending_order(uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.customer_cancel_recent_order(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN RETURN public.customer_cancel_pending_order(p_order_id); END; $$;
REVOKE ALL ON FUNCTION public.customer_cancel_recent_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_cancel_recent_order(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_paid_order_cancellation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 -- Trusted payment callbacks/background jobs retain their existing service access.
 -- Authenticated actors must pass the authoritative admin role check even through SECURITY DEFINER RPCs.
 IF auth.uid() IS NULL OR public.has_role(auth.uid(),'admin'::public.app_role) THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 IF TG_OP='DELETE' THEN
  IF OLD.payment_status IN ('paid','refunded') OR OLD.paid_at IS NOT NULL OR OLD.payment_completed_at IS NOT NULL THEN
   RAISE EXCEPTION 'Only a Mfula administrator can remove a paid order' USING ERRCODE='42501';
  END IF;
  RETURN OLD;
 END IF;
 IF (OLD.payment_status IN ('paid','refunded') OR OLD.paid_at IS NOT NULL OR OLD.payment_completed_at IS NOT NULL)
 AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('cancelled','rejected') THEN
  RAISE EXCEPTION 'Payment Successful – Order Cannot Be Cancelled. Only a Mfula administrator can approve an exception.' USING ERRCODE='42501';
 END IF;
 IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
 OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
 OR NEW.payment_completed_at IS DISTINCT FROM OLD.payment_completed_at
 OR NEW.payment_refunded_at IS DISTINCT FROM OLD.payment_refunded_at
 OR NEW.refund_status IS DISTINCT FROM OLD.refund_status
 OR NEW.refund_amount IS DISTINCT FROM OLD.refund_amount
 OR NEW.refund_method IS DISTINCT FROM OLD.refund_method
 OR NEW.refunded_at IS DISTINCT FROM OLD.refunded_at THEN
  RAISE EXCEPTION 'Only Mfula administration or verified payment processing can change payment or refund records' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_paid_order_cancellation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER z_guard_paid_order_cancellation BEFORE UPDATE OR DELETE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_paid_order_cancellation();
-- Customers cannot issue wallet credits or initiate a refund; existing admin refund operations remain available.
REVOKE ALL ON FUNCTION public.customer_choose_refund(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_choose_refund(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.auto_cancel_stale_orders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count integer;
BEGIN
 WITH updated AS (
 UPDATE public.orders SET status='cancelled',driver_id=NULL,cancelled_at=COALESCE(cancelled_at,now()),cancel_reason=COALESCE(cancel_reason,'Auto-cancelled: not completed within 12 hours')
 WHERE status IN ('awaiting_restaurant','pending','confirmed','preparing','ready','driver_assigned','picking_up','arrived_at_restaurant','out_for_delivery')
 AND payment_status NOT IN ('paid','refunded') AND paid_at IS NULL AND payment_completed_at IS NULL
 AND created_at < now()-interval '12 hours' RETURNING id)
 SELECT count(*) INTO v_count FROM updated;
 RETURN v_count;
END; $$;
COMMENT ON FUNCTION public.customer_cancel_pending_order(uuid) IS 'Customer cancellation is allowed only before verified payment; row locking serializes against payment confirmation. No age limit for unpaid orders.';
COMMENT ON FUNCTION public.customer_cancel_recent_order(uuid) IS 'Compatibility alias for unpaid-only cancellation; the previous five-minute paid cancellation path is retired.';