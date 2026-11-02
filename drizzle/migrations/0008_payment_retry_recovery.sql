ALTER TABLE public.yoco_checkout_attempts ADD COLUMN retry_of_checkout text;
CREATE OR REPLACE FUNCTION public.rotate_yoco_checkout_attempt(p_order_id uuid,p_token uuid,p_previous_checkout text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.yoco_checkout_attempts; k uuid;
BEGIN
 PERFORM 1 FROM public.orders WHERE id=p_order_id AND status='pending_payment' AND payment_checkout_id=p_previous_checkout FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Checkout changed; refresh payment status'; END IF;
 SELECT * INTO a FROM public.yoco_checkout_attempts WHERE order_id=p_order_id AND lease_token=p_token AND lease_until>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Checkout lease expired'; END IF;
 IF a.retry_of_checkout=p_previous_checkout THEN RETURN a.idempotency_key; END IF;
 k := gen_random_uuid();
 UPDATE public.yoco_checkout_attempts SET idempotency_key=k,retry_of_checkout=p_previous_checkout,updated_at=now() WHERE order_id=p_order_id;
 RETURN k;
END; $$;
REVOKE ALL ON FUNCTION public.rotate_yoco_checkout_attempt(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_yoco_checkout_attempt(uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_reserved_payment_amounts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.status='pending_payment' AND OLD.payment_checkout_id IS NOT NULL AND
 (NEW.total IS DISTINCT FROM OLD.total OR NEW.subtotal IS DISTINCT FROM OLD.subtotal OR NEW.tax IS DISTINCT FROM OLD.tax OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee OR NEW.tip IS DISTINCT FROM OLD.tip OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount OR NEW.credits_applied IS DISTINCT FROM OLD.credits_applied OR NEW.items IS DISTINCT FROM OLD.items) THEN
 RAISE EXCEPTION 'Payment already reserved; order prices cannot change during checkout';
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_reserved_payment_amounts() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_reserved_payment_amounts BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_reserved_payment_amounts();

CREATE OR REPLACE FUNCTION public.mark_online_payment_failed(p_order_id uuid,p_provider text,p_payment_id text,p_status text,p_reason text,p_raw_payload jsonb,p_source_ip text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders; v_status text := lower(COALESCE(p_status,'failed')); incoming_checkout text;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF o.id IS NULL OR o.status<>'pending_payment' OR o.payment_status='paid' THEN RETURN; END IF;
 incoming_checkout := COALESCE(p_raw_payload->>'id',p_raw_payload->'payload'->>'checkoutId',p_raw_payload->'payload'->>'checkout_id');
 IF incoming_checkout IS NOT NULL AND o.payment_checkout_id IS DISTINCT FROM incoming_checkout THEN RETURN; END IF;
 IF v_status NOT IN ('failed','cancelled') THEN v_status := 'failed'; END IF;
 IF o.payment_status=v_status AND o.payment_provider_txn_id IS NOT DISTINCT FROM p_payment_id THEN RETURN; END IF;
 INSERT INTO public.payment_transactions(order_id,provider,provider_txn_id,payment_status,raw_payload,signature_valid,source_ip)
 VALUES(p_order_id,COALESCE(p_provider,'yoco'),p_payment_id,upper(v_status),p_raw_payload,true,p_source_ip);
 UPDATE public.orders SET payment_status=v_status,payment_failed_at=now(),payment_failure_reason=p_reason,payment_provider_txn_id=COALESCE(p_payment_id,payment_provider_txn_id) WHERE id=p_order_id;
END; $$;
REVOKE ALL ON FUNCTION public.mark_online_payment_failed(uuid,text,text,text,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mark_online_payment_failed(uuid,text,text,text,text,jsonb,text) TO service_role;