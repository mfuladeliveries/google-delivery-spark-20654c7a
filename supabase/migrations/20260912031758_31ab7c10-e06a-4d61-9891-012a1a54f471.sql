
CREATE OR REPLACE FUNCTION public.mark_refund_pending_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('cancelled', 'rejected')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.payment_method = 'online'
     AND NEW.payment_status = 'paid'
     AND NEW.refund_status IS NULL
     AND (NEW.total - COALESCE(NEW.credits_applied, 0)) > 0 THEN
    NEW.refund_status := 'pending';
    NEW.refund_amount := NEW.total - COALESCE(NEW.credits_applied, 0);
  END IF;
  RETURN NEW;
END;
$function$;

UPDATE public.orders
SET refund_status = NULL, refund_amount = NULL
WHERE refund_status = 'pending'
  AND coalesce(payment_status,'') <> 'paid';

DROP POLICY IF EXISTS "Users view referral codes" ON public.referral_codes;
CREATE POLICY "Users view own referral code"
ON public.referral_codes FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
