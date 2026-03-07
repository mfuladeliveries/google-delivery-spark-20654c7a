-- Add location columns to driver_profiles for nearest-driver matching
ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS current_lat double precision,
  ADD COLUMN IF NOT EXISTS current_lng double precision,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamp with time zone;

-- Create function to auto-assign nearest online driver
CREATE OR REPLACE FUNCTION public.auto_assign_driver()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_driver_id uuid;
  v_restaurant_lat double precision;
  v_restaurant_lng double precision;
BEGIN
  -- Only trigger when status changes TO 'ready' and no driver is assigned
  IF NEW.status = 'ready' AND (OLD.status IS DISTINCT FROM 'ready') AND NEW.driver_id IS NULL THEN
    
    -- Find nearest online driver who is not currently on an active delivery
    SELECT dp.user_id INTO v_driver_id
    FROM driver_profiles dp
    WHERE dp.is_online = true
      AND dp.current_lat IS NOT NULL
      AND dp.current_lng IS NOT NULL
      -- Exclude drivers with active deliveries
      AND NOT EXISTS (
        SELECT 1 FROM orders o
        WHERE o.driver_id = dp.user_id
          AND o.status IN ('driver_assigned', 'picking_up', 'out_for_delivery')
      )
    ORDER BY
      -- Simple distance approximation (good enough for local delivery)
      CASE WHEN dp.current_lat IS NOT NULL THEN
        power(dp.current_lat - COALESCE(v_restaurant_lat, dp.current_lat), 2) +
        power(dp.current_lng - COALESCE(v_restaurant_lng, dp.current_lng), 2)
      ELSE 999999 END
    LIMIT 1;

    IF v_driver_id IS NOT NULL THEN
      NEW.driver_id := v_driver_id;
      NEW.status := 'driver_assigned';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS trg_auto_assign_driver ON public.orders;
CREATE TRIGGER trg_auto_assign_driver
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_driver();