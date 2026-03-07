CREATE OR REPLACE FUNCTION public.hash_delivery_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NEW.delivery_code IS NOT NULL AND NEW.delivery_code != '' THEN
    NEW.delivery_code_hash := encode(extensions.digest(NEW.delivery_code, 'sha256'), 'hex');
    NEW.delivery_code := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_and_complete_delivery(p_order_id uuid, p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_hash text;
BEGIN
  v_hash := encode(extensions.digest(p_code, 'sha256'), 'hex');
  UPDATE orders SET status = 'delivered'
  WHERE id = p_order_id
    AND driver_id = auth.uid()
    AND delivery_code_hash = v_hash
    AND status = 'out_for_delivery';
  RETURN FOUND;
END;
$function$;