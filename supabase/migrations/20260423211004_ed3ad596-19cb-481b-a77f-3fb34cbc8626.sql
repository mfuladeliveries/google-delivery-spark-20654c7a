-- Update driver earnings: fixed payout per zone
-- Zone 1 (R65 customer fee) -> driver R45, platform R20
-- Zone 2 (R75 customer fee) -> driver R55, platform R20
CREATE OR REPLACE FUNCTION public.update_driver_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_fee numeric;
  v_driver_share numeric;
  v_platform_share numeric;
BEGIN
  IF NEW.status = 'delivered'
     AND (OLD.status IS DISTINCT FROM 'delivered')
     AND NEW.driver_id IS NOT NULL THEN

    v_customer_fee := COALESCE(NEW.delivery_fee, 65);

    -- Fixed driver payouts by zone (matched on customer-facing delivery fee)
    IF v_customer_fee >= 75 THEN
      -- Zone 2
      v_driver_share := 55;
    ELSIF v_customer_fee >= 65 THEN
      -- Zone 1
      v_driver_share := 45;
    ELSE
      -- Fallback for any legacy/edge fee: keep 70/30 split
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
$$;