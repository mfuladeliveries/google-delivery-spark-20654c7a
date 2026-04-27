-- Update earnings trigger to read driver payouts from app_settings.delivery_fees
-- so admins can change customer-facing fee and driver payout per zone without code changes.

-- Seed default delivery_fees if missing (mirrors current hardcoded values)
INSERT INTO public.app_settings (key, value)
VALUES (
  'delivery_fees',
  jsonb_build_object(
    'inner_fee', 65,
    'outer_fee', 75,
    'inner_driver_payout', 45,
    'outer_driver_payout', 55
  )
)
ON CONFLICT (key) DO NOTHING;

-- Replace earnings trigger function to read payouts from settings
CREATE OR REPLACE FUNCTION public.update_driver_earnings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_fee numeric;
  v_driver_share numeric;
  v_platform_share numeric;
  v_settings jsonb;
  v_inner_fee numeric;
  v_outer_fee numeric;
  v_inner_payout numeric;
  v_outer_payout numeric;
BEGIN
  IF NEW.status = 'delivered'
     AND (OLD.status IS DISTINCT FROM 'delivered')
     AND NEW.driver_id IS NOT NULL THEN

    v_customer_fee := COALESCE(NEW.delivery_fee, 65);

    SELECT value INTO v_settings FROM public.app_settings WHERE key = 'delivery_fees';
    v_inner_fee   := COALESCE((v_settings->>'inner_fee')::numeric, 65);
    v_outer_fee   := COALESCE((v_settings->>'outer_fee')::numeric, 75);
    v_inner_payout := COALESCE((v_settings->>'inner_driver_payout')::numeric, 45);
    v_outer_payout := COALESCE((v_settings->>'outer_driver_payout')::numeric, 55);

    IF v_customer_fee >= v_outer_fee THEN
      v_driver_share := v_outer_payout;
    ELSIF v_customer_fee >= v_inner_fee THEN
      v_driver_share := v_inner_payout;
    ELSE
      v_driver_share := ROUND(v_customer_fee * 0.70, 2);
    END IF;

    v_platform_share := GREATEST(v_customer_fee - v_driver_share, 0);

    INSERT INTO public.driver_earnings (driver_id, order_id, delivery_fee, driver_payout, platform_fee)
    VALUES (NEW.driver_id, NEW.id, v_customer_fee, v_driver_share, v_platform_share)
    ON CONFLICT DO NOTHING;

    UPDATE public.driver_profiles
    SET total_earnings = total_earnings + v_driver_share,
        total_deliveries = total_deliveries + 1,
        updated_at = now()
    WHERE user_id = NEW.driver_id;
  END IF;

  RETURN NEW;
END;
$function$;