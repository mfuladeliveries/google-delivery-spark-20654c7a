
-- Add delivered_at timestamp column
ALTER TABLE public.orders ADD COLUMN delivered_at timestamp with time zone DEFAULT NULL;

-- Update verify_and_complete_delivery to set delivered_at
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
  UPDATE orders SET status = 'delivered', delivered_at = now()
  WHERE id = p_order_id
    AND driver_id = auth.uid()
    AND delivery_code_hash = v_hash
    AND status = 'out_for_delivery';
  RETURN FOUND;
END;
$function$;

-- Also update the earnings trigger to use delivered_at
CREATE OR REPLACE FUNCTION public.update_driver_earnings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' AND NEW.driver_id IS NOT NULL THEN
    UPDATE driver_profiles
    SET total_earnings = total_earnings + NEW.delivery_fee,
        total_deliveries = total_deliveries + 1,
        updated_at = now()
    WHERE user_id = NEW.driver_id;
  END IF;
  RETURN NEW;
END;
$function$;
