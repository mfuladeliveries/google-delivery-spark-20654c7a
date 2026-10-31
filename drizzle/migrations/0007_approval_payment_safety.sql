CREATE TABLE public.yoco_checkout_attempts (
 order_id uuid PRIMARY KEY REFERENCES public.orders(id),
 idempotency_key uuid NOT NULL DEFAULT gen_random_uuid(),
 lease_token uuid,
 lease_until timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.yoco_checkout_attempts TO service_role;
ALTER TABLE public.yoco_checkout_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_checkout_attempts ON public.yoco_checkout_attempts TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.payment_notification_outbox (
 order_id uuid PRIMARY KEY REFERENCES public.orders(id),
 attempts integer NOT NULL DEFAULT 0,
 available_at timestamptz NOT NULL DEFAULT now(),
 lease_token uuid,
 lease_until timestamptz,
 sent_at timestamptz,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.payment_notification_outbox TO service_role;
ALTER TABLE public.payment_notification_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_payment_notifications ON public.payment_notification_outbox TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.claim_yoco_checkout(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders; a public.yoco_checkout_attempts; t uuid := gen_random_uuid();
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF o.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF o.payment_status='paid' THEN RETURN jsonb_build_object('already_paid',true); END IF;
 IF o.status <> 'pending_payment' OR o.payment_method <> 'online' OR o.payment_status IN ('expired','refunded') THEN RAISE EXCEPTION 'This order is not awaiting payment'; END IF;
 IF COALESCE(o.payment_initiated_at,o.created_at) < now()-interval '30 minutes' THEN RAISE EXCEPTION 'Payment reservation expired'; END IF;
 INSERT INTO public.yoco_checkout_attempts(order_id) VALUES(p_order_id) ON CONFLICT DO NOTHING;
 SELECT * INTO a FROM public.yoco_checkout_attempts WHERE order_id=p_order_id FOR UPDATE;
 IF a.lease_until > now() THEN RETURN jsonb_build_object('busy',true); END IF;
 UPDATE public.yoco_checkout_attempts SET lease_token=t,lease_until=now()+interval '2 minutes',updated_at=now() WHERE order_id=p_order_id;
 RETURN jsonb_build_object('lease_token',t,'idempotency_key',a.idempotency_key);
END; $$;
REVOKE ALL ON FUNCTION public.claim_yoco_checkout(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_yoco_checkout(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.rotate_yoco_checkout_attempt(p_order_id uuid,p_token uuid,p_previous_checkout text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE k uuid := gen_random_uuid();
BEGIN
 PERFORM 1 FROM public.orders WHERE id=p_order_id AND status='pending_payment' AND payment_checkout_id=p_previous_checkout FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Checkout changed; refresh payment status'; END IF;
 UPDATE public.yoco_checkout_attempts SET idempotency_key=k,updated_at=now() WHERE order_id=p_order_id AND lease_token=p_token AND lease_until>now();
 IF NOT FOUND THEN RAISE EXCEPTION 'Checkout lease expired'; END IF;
 RETURN k;
END; $$;
REVOKE ALL ON FUNCTION public.rotate_yoco_checkout_attempt(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_yoco_checkout_attempt(uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_yoco_checkout(p_order_id uuid,p_token uuid,p_checkout_id text,p_reference text,p_mode text,p_amount numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM 1 FROM public.orders WHERE id=p_order_id AND status='pending_payment' AND payment_status<>'paid' AND total=p_amount FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order changed; refresh payment status'; END IF;
 PERFORM 1 FROM public.yoco_checkout_attempts WHERE order_id=p_order_id AND lease_token=p_token AND lease_until>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Checkout lease expired'; END IF;
 IF p_mode NOT IN ('live','test') OR p_checkout_id IS NULL THEN RAISE EXCEPTION 'Invalid checkout'; END IF;
 UPDATE public.orders SET payment_provider='yoco',payment_checkout_id=p_checkout_id,payment_reference=p_reference,payment_amount=p_amount,payment_currency='ZAR',payment_status='pending',payment_environment=p_mode WHERE id=p_order_id;
 UPDATE public.yoco_checkout_attempts SET lease_token=NULL,lease_until=NULL,updated_at=now() WHERE order_id=p_order_id AND lease_token=p_token;
END; $$;
REVOKE ALL ON FUNCTION public.finish_yoco_checkout(uuid,uuid,text,text,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_yoco_checkout(uuid,uuid,text,text,text,numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.queue_paid_order_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.payment_status='paid' AND OLD.payment_status IS DISTINCT FROM 'paid' THEN
  INSERT INTO public.payment_notification_outbox(order_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.queue_paid_order_notifications() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER queue_paid_order_notifications AFTER UPDATE OF payment_status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.queue_paid_order_notifications();

CREATE OR REPLACE FUNCTION public.claim_payment_notifications(p_order_id uuid DEFAULT NULL)
RETURNS SETOF public.payment_notification_outbox LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 RETURN QUERY WITH eligible AS (
 SELECT order_id FROM public.payment_notification_outbox
 WHERE sent_at IS NULL AND available_at<=now() AND (lease_until IS NULL OR lease_until<now()) AND (p_order_id IS NULL OR order_id=p_order_id)
 ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED
 ) UPDATE public.payment_notification_outbox n SET lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=n.attempts+1
 FROM eligible e WHERE n.order_id=e.order_id RETURNING n.*;
END; $$;
REVOKE ALL ON FUNCTION public.claim_payment_notifications(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_payment_notifications(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_online_payment(p_order_id uuid,p_provider text,p_payment_id text,p_checkout_id text,p_reference text,p_amount_gross numeric,p_amount_fee numeric,p_amount_net numeric,p_payment_method text,p_currency text,p_raw_payload jsonb,p_source_ip text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders; v_status text; v_approval text;
BEGIN
 IF p_provider IS DISTINCT FROM 'yoco' OR upper(COALESCE(p_currency,'ZAR')) <> 'ZAR' THEN RAISE EXCEPTION 'Invalid payment provider or currency'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF o.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF o.payment_status='paid' THEN
  RETURN jsonb_build_object('order_id',o.id,'order_number',o.order_number,'restaurant',o.restaurant,'restaurant_id',o.restaurant_id,'total',o.total,'user_id',o.user_id,'newly_paid',false,'new_status',o.status,'requires_confirmation',false);
 END IF;
 IF o.status <> 'pending_payment' THEN RAISE EXCEPTION 'Order is not awaiting payment'; END IF;
 IF p_checkout_id IS NULL OR o.payment_checkout_id IS DISTINCT FROM p_checkout_id THEN RAISE EXCEPTION 'Payment checkout does not match order'; END IF;
 IF p_amount_gross IS NULL OR abs(p_amount_gross-o.total)>0.005 THEN RAISE EXCEPTION 'Payment amount does not match order total'; END IF;
 IF COALESCE(p_raw_payload->>'payment_mode',o.payment_environment) <> o.payment_environment THEN RAISE EXCEPTION 'Payment environment does not match order'; END IF;
 IF p_payment_id IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('yoco-payment:'||p_payment_id,0));
  IF EXISTS(SELECT 1 FROM public.payment_transactions WHERE provider='yoco' AND provider_txn_id=p_payment_id AND payment_status='COMPLETE' AND order_id<>p_order_id) THEN RAISE EXCEPTION 'Payment already belongs to another order'; END IF;
 END IF;
 SELECT approval_mode INTO v_approval FROM public.restaurants WHERE id=o.restaurant_id;
 v_status := CASE WHEN COALESCE(v_approval,'auto') IN ('restaurant','admin') THEN 'confirmed' ELSE 'ready' END;
 INSERT INTO public.payment_transactions(order_id,provider,provider_txn_id,payment_status,amount_gross,amount_fee,amount_net,payment_method,raw_payload,signature_valid,source_ip)
 VALUES(p_order_id,'yoco',p_payment_id,'COMPLETE',p_amount_gross,p_amount_fee,p_amount_net,p_payment_method,p_raw_payload,true,p_source_ip);
 UPDATE public.orders SET status=v_status,payment_status='paid',payment_provider='yoco',payment_provider_txn_id=p_payment_id,payment_reference=COALESCE(p_reference,payment_reference),payment_amount=p_amount_gross,payment_currency='ZAR',payment_completed_at=now(),paid_at=now() WHERE id=p_order_id;
 RETURN jsonb_build_object('order_id',o.id,'order_number',o.order_number,'restaurant',o.restaurant,'restaurant_id',o.restaurant_id,'total',o.total,'user_id',o.user_id,'newly_paid',true,'new_status',v_status,'requires_confirmation',false);
END; $$;
REVOKE ALL ON FUNCTION public.confirm_online_payment(uuid,text,text,text,text,numeric,numeric,numeric,text,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_online_payment(uuid,text,text,text,text,numeric,numeric,numeric,text,text,jsonb,text) TO service_role;