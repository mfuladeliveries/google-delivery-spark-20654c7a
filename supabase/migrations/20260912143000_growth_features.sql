-- Growth features: promo/referral codes + WhatsApp notification outbox.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS referral_code text;

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  min_order numeric NOT NULL DEFAULT 0 CHECK (min_order >= 0),
  max_discount numeric,
  usage_limit integer,
  usage_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage promo codes" ON public.promo_codes;
CREATE POLICY "Admins manage promo codes" ON public.promo_codes FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
DROP POLICY IF EXISTS "Customers read active promo codes" ON public.promo_codes;
CREATE POLICY "Customers read active promo codes" ON public.promo_codes FOR SELECT TO authenticated
  USING (active = true AND starts_at <= now() AND (ends_at IS NULL OR ends_at >= now()));

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id uuid NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  discount_amount numeric NOT NULL CHECK (discount_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promo_id, user_id)
);
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Customers view own promo redemptions" ON public.promo_redemptions;
CREATE POLICY "Customers view own promo redemptions" ON public.promo_redemptions FOR SELECT TO authenticated USING (user_id=auth.uid());
DROP POLICY IF EXISTS "Admins view promo redemptions" ON public.promo_redemptions;
CREATE POLICY "Admins view promo redemptions" ON public.promo_redemptions FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view referral codes" ON public.referral_codes;
CREATE POLICY "Users view referral codes" ON public.referral_codes FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL,
  referred_user_id uuid NOT NULL UNIQUE,
  referral_code text NOT NULL,
  referred_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  referred_discount numeric NOT NULL DEFAULT 10,
  referrer_reward numeric NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','rewarded','cancelled')),
  rewarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (referrer_user_id <> referred_user_id)
);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own referrals" ON public.referrals;
CREATE POLICY "Users view own referrals" ON public.referrals FOR SELECT TO authenticated
  USING (referrer_user_id=auth.uid() OR referred_user_id=auth.uid() OR has_role(auth.uid(),'admin'::app_role));

-- Permit referral entries in the existing wallet ledger.
ALTER TABLE public.credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_kind_check;
ALTER TABLE public.credit_transactions ADD CONSTRAINT credit_transactions_kind_check
  CHECK (kind IN ('refund','spend','adjustment','reversal','referral'));

CREATE OR REPLACE FUNCTION public.get_or_create_referral_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid := auth.uid(); v_code text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT code INTO v_code FROM public.referral_codes WHERE user_id=v_user;
  IF v_code IS NULL THEN
    v_code := 'MF' || upper(substr(md5(v_user::text || clock_timestamp()::text),1,6));
    INSERT INTO public.referral_codes(user_id,code) VALUES(v_user,v_code)
      ON CONFLICT (user_id) DO UPDATE SET user_id=excluded.user_id
      RETURNING code INTO v_code;
  END IF;
  RETURN v_code;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_or_create_referral_code() TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_checkout_code(p_order_id uuid, p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_user uuid := auth.uid(); v_order record; v_promo record; v_ref record; v_discount numeric := 0; v_code text := upper(trim(p_code));
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_code = '' THEN RAISE EXCEPTION 'Enter a code'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id AND user_id=v_user FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF COALESCE(v_order.payment_status,'pending') IN ('paid','completed','refunded') OR v_order.payment_checkout_id IS NOT NULL THEN
    RAISE EXCEPTION 'This order can no longer be discounted';
  END IF;
  IF COALESCE(v_order.discount_amount,0) > 0 THEN RAISE EXCEPTION 'A code is already applied'; END IF;

  SELECT * INTO v_promo FROM public.promo_codes WHERE upper(code)=v_code AND active=true
    AND starts_at <= now() AND (ends_at IS NULL OR ends_at >= now()) FOR UPDATE;
  IF v_promo.id IS NOT NULL THEN
    IF v_order.subtotal < v_promo.min_order THEN RAISE EXCEPTION 'Minimum order is R%', v_promo.min_order; END IF;
    IF v_promo.usage_limit IS NOT NULL AND v_promo.usage_count >= v_promo.usage_limit THEN RAISE EXCEPTION 'This promo code has reached its limit'; END IF;
    IF EXISTS (SELECT 1 FROM public.promo_redemptions WHERE promo_id=v_promo.id AND user_id=v_user) THEN RAISE EXCEPTION 'You have already used this promo code'; END IF;
    IF v_promo.discount_type='percent' THEN v_discount := round((v_order.subtotal * v_promo.discount_value / 100.0)::numeric,2); ELSE v_discount := v_promo.discount_value; END IF;
    IF v_promo.max_discount IS NOT NULL THEN v_discount := least(v_discount,v_promo.max_discount); END IF;
    v_discount := least(v_discount,v_order.total);
    UPDATE public.orders SET discount_amount=v_discount,promo_code=v_promo.code,total=greatest(0,total-v_discount) WHERE id=p_order_id;
    INSERT INTO public.promo_redemptions(promo_id,order_id,user_id,discount_amount) VALUES(v_promo.id,p_order_id,v_user,v_discount);
    UPDATE public.promo_codes SET usage_count=usage_count+1 WHERE id=v_promo.id;
    RETURN jsonb_build_object('type','promo','code',v_promo.code,'discount',v_discount,'message','Promo applied');
  END IF;

  SELECT * INTO v_ref FROM public.referral_codes WHERE upper(code)=v_code;
  IF v_ref.id IS NOT NULL THEN
    IF v_ref.user_id=v_user THEN RAISE EXCEPTION 'You cannot use your own referral code'; END IF;
    IF EXISTS (SELECT 1 FROM public.orders WHERE user_id=v_user AND id<>p_order_id AND status='delivered') THEN RAISE EXCEPTION 'Referral codes are for new customers only'; END IF;
    IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_user_id=v_user) THEN RAISE EXCEPTION 'A referral code has already been used on this account'; END IF;
    v_discount := least(10::numeric,v_order.total);
    INSERT INTO public.referrals(referrer_user_id,referred_user_id,referral_code,referred_order_id,referred_discount,referrer_reward)
      VALUES(v_ref.user_id,v_user,v_ref.code,p_order_id,v_discount,10);
    UPDATE public.orders SET discount_amount=v_discount,referral_code=v_ref.code,total=greatest(0,total-v_discount) WHERE id=p_order_id;
    RETURN jsonb_build_object('type','referral','code',v_ref.code,'discount',v_discount,'message','Referral applied');
  END IF;
  RAISE EXCEPTION 'Invalid or expired code';
END; $$;
GRANT EXECUTE ON FUNCTION public.apply_checkout_code(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reward_referral_on_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_ref record;
BEGIN
  IF NEW.status='delivered' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT * INTO v_ref FROM public.referrals WHERE referred_order_id=NEW.id AND status='pending' FOR UPDATE;
    IF v_ref.id IS NOT NULL THEN
      INSERT INTO public.customer_credits(user_id,balance) VALUES(v_ref.referrer_user_id,v_ref.referrer_reward)
      ON CONFLICT(user_id) DO UPDATE SET balance=customer_credits.balance+excluded.balance, updated_at=now();
      INSERT INTO public.credit_transactions(user_id,amount,kind,order_id,note)
      VALUES(v_ref.referrer_user_id,v_ref.referrer_reward,'referral',NEW.id,'Referral reward');
      UPDATE public.referrals SET status='rewarded',rewarded_at=now() WHERE id=v_ref.id;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_reward_referral_on_delivery ON public.orders;
CREATE TRIGGER trg_reward_referral_on_delivery AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.reward_referral_on_delivery();

CREATE TABLE IF NOT EXISTS public.whatsapp_notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  recipient text NOT NULL,
  message text NOT NULL,
  event_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id,event_key)
);
ALTER TABLE public.whatsapp_notification_outbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins view WhatsApp queue" ON public.whatsapp_notification_outbox;
CREATE POLICY "Admins view WhatsApp queue" ON public.whatsapp_notification_outbox FOR SELECT TO authenticated USING(has_role(auth.uid(),'admin'::app_role));

CREATE OR REPLACE FUNCTION public.queue_order_whatsapp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_msg text; v_key text;
BEGIN
  IF TG_OP='INSERT' THEN RETURN NEW; END IF;
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  v_key := 'status_' || NEW.status;
  v_msg := CASE NEW.status
    WHEN 'confirmed' THEN 'Mfula Deliveries: Order #'||NEW.order_number||' is confirmed by '||NEW.restaurant||'.'
    WHEN 'preparing' THEN 'Mfula Deliveries: Order #'||NEW.order_number||' is being prepared.'
    WHEN 'ready' THEN 'Mfula Deliveries: Order #'||NEW.order_number||' is ready for driver collection.'
    WHEN 'driver_assigned' THEN 'Mfula Deliveries: A driver has been assigned to order #'||NEW.order_number||'.'
    WHEN 'out_for_delivery' THEN 'Mfula Deliveries: Order #'||NEW.order_number||' is on the way. Keep your delivery PIN private until the order arrives.'
    WHEN 'delivered' THEN 'Mfula Deliveries: Order #'||NEW.order_number||' was delivered. Thank you for ordering with us!'
    WHEN 'cancelled' THEN 'Mfula Deliveries: Order #'||NEW.order_number||' was cancelled. Open the app for refund/status information.'
    WHEN 'rejected' THEN 'Mfula Deliveries: Order #'||NEW.order_number||' could not be accepted. Open the app for refund/status information.'
    ELSE NULL END;
  IF v_msg IS NOT NULL AND COALESCE(trim(NEW.customer_contact),'')<>'' THEN
    INSERT INTO public.whatsapp_notification_outbox(order_id,recipient,message,event_key)
    VALUES(NEW.id,NEW.customer_contact,v_msg,v_key) ON CONFLICT(order_id,event_key) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_queue_order_whatsapp ON public.orders;
CREATE TRIGGER trg_queue_order_whatsapp AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.queue_order_whatsapp();
