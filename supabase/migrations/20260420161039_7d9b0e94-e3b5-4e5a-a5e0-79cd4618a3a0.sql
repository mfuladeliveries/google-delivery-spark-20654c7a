-- 1. Create driver_earnings table
CREATE TABLE IF NOT EXISTS public.driver_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  order_id uuid NOT NULL UNIQUE,
  delivery_fee numeric NOT NULL DEFAULT 0,
  driver_payout numeric NOT NULL DEFAULT 0,
  platform_fee numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_earnings_driver ON public.driver_earnings(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_earnings_created ON public.driver_earnings(created_at DESC);

ALTER TABLE public.driver_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers view own earnings"
  ON public.driver_earnings FOR SELECT
  TO authenticated
  USING (auth.uid() = driver_id);

CREATE POLICY "Admins view all earnings"
  ON public.driver_earnings FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Replace the earnings trigger to ALSO write into driver_earnings
CREATE OR REPLACE FUNCTION public.update_driver_earnings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_fee numeric := 55; -- customer-facing delivery fee
  v_driver_share numeric;
  v_platform_share numeric;
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') AND NEW.driver_id IS NOT NULL THEN
    v_driver_share := ROUND(v_customer_fee * 0.70, 2);
    v_platform_share := ROUND(v_customer_fee * 0.30, 2);

    -- Insert earnings record (idempotent thanks to UNIQUE on order_id)
    INSERT INTO public.driver_earnings (driver_id, order_id, delivery_fee, driver_payout, platform_fee)
    VALUES (NEW.driver_id, NEW.id, v_customer_fee, v_driver_share, v_platform_share)
    ON CONFLICT (order_id) DO NOTHING;

    -- Bump driver profile counters with the driver share
    UPDATE driver_profiles
    SET total_earnings = total_earnings + v_driver_share,
        total_deliveries = total_deliveries + 1,
        updated_at = now()
    WHERE user_id = NEW.driver_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS trg_update_driver_earnings ON public.orders;
CREATE TRIGGER trg_update_driver_earnings
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_driver_earnings();

-- 3. Backfill earnings for past delivered orders
INSERT INTO public.driver_earnings (driver_id, order_id, delivery_fee, driver_payout, platform_fee, created_at)
SELECT
  driver_id,
  id,
  55,
  ROUND(55 * 0.70, 2),
  ROUND(55 * 0.30, 2),
  COALESCE(delivered_at, created_at)
FROM public.orders
WHERE status = 'delivered'
  AND driver_id IS NOT NULL
ON CONFLICT (order_id) DO NOTHING;

-- 4. Recompute driver totals from driver_earnings
UPDATE public.driver_profiles dp
SET total_earnings = COALESCE(s.total, 0),
    total_deliveries = COALESCE(s.cnt, 0),
    updated_at = now()
FROM (
  SELECT driver_id, SUM(driver_payout) AS total, COUNT(*) AS cnt
  FROM public.driver_earnings
  GROUP BY driver_id
) s
WHERE dp.user_id = s.driver_id;