
-- Seed default split if missing
INSERT INTO public.app_settings (key, value)
VALUES ('driver_split_percent', jsonb_build_object('percent', 70))
ON CONFLICT (key) DO NOTHING;

-- Updated driver earnings trigger that reads the configured split
CREATE OR REPLACE FUNCTION public.update_driver_earnings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_fee numeric;
  v_split_pct numeric;
  v_driver_share numeric;
  v_platform_share numeric;
BEGIN
  IF NEW.status = 'delivered'
     AND (OLD.status IS DISTINCT FROM 'delivered')
     AND NEW.driver_id IS NOT NULL THEN

    v_customer_fee := COALESCE(NEW.delivery_fee, 0);

    SELECT GREATEST(0, LEAST(100, COALESCE((value->>'percent')::numeric, 70)))
    INTO v_split_pct
    FROM public.app_settings
    WHERE key = 'driver_split_percent';

    v_split_pct := COALESCE(v_split_pct, 70);

    v_driver_share := ROUND(v_customer_fee * v_split_pct / 100.0, 2);
    v_platform_share := GREATEST(v_customer_fee - v_driver_share, 0);

    INSERT INTO public.driver_earnings (driver_id, order_id, delivery_fee, driver_payout, platform_fee)
    VALUES (NEW.driver_id, NEW.id, v_customer_fee, v_driver_share, v_platform_share)
    ON CONFLICT DO NOTHING;

    UPDATE public.driver_profiles
    SET total_earnings = COALESCE(total_earnings, 0) + v_driver_share,
        total_deliveries = COALESCE(total_deliveries, 0) + 1,
        updated_at = now()
    WHERE user_id = NEW.driver_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Extend audit trigger function to handle app_settings (driver_split_percent only)
CREATE OR REPLACE FUNCTION public.write_fee_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_entity text;
  v_email text;
  v_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'delivery_areas' THEN
    v_entity := 'delivery_area';
    v_id := COALESCE(NEW.id, OLD.id);
  ELSIF TG_TABLE_NAME = 'peak_surcharge_windows' THEN
    v_entity := 'peak_window';
    v_id := COALESCE(NEW.id, OLD.id);
  ELSIF TG_TABLE_NAME = 'app_settings' THEN
    -- Only audit fee-related settings
    IF COALESCE(NEW.key, OLD.key) <> 'driver_split_percent' THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
    v_entity := 'driver_split';
    v_id := NULL;
  ELSE
    v_entity := TG_TABLE_NAME;
    v_id := NULL;
  END IF;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_email := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.fee_audit_log (entity_type, entity_id, action, new_values, changed_by, changed_by_email)
    VALUES (v_entity, v_id, 'insert', to_jsonb(NEW), auth.uid(), v_email);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.fee_audit_log (entity_type, entity_id, action, old_values, new_values, changed_by, changed_by_email)
    VALUES (v_entity, v_id, 'update', to_jsonb(OLD), to_jsonb(NEW), auth.uid(), v_email);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.fee_audit_log (entity_type, entity_id, action, old_values, changed_by, changed_by_email)
    VALUES (v_entity, v_id, 'delete', to_jsonb(OLD), auth.uid(), v_email);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_app_settings ON public.app_settings;
CREATE TRIGGER trg_audit_app_settings
  AFTER INSERT OR UPDATE OR DELETE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.write_fee_audit();
