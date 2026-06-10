
-- ============ Peak surcharge windows ============
CREATE TABLE public.peak_surcharge_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  day_of_week smallint, -- 0=Sun..6=Sat, NULL = every day
  start_time time NOT NULL,
  end_time time NOT NULL,
  flat_amount numeric(8,2) NOT NULL CHECK (flat_amount >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT peak_dow_range CHECK (day_of_week IS NULL OR (day_of_week BETWEEN 0 AND 6))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.peak_surcharge_windows TO authenticated;
GRANT SELECT ON public.peak_surcharge_windows TO anon;
GRANT ALL ON public.peak_surcharge_windows TO service_role;

ALTER TABLE public.peak_surcharge_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active peak windows"
  ON public.peak_surcharge_windows FOR SELECT
  USING (true);

CREATE POLICY "Admins manage peak windows"
  ON public.peak_surcharge_windows FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_peak_windows_updated_at
  BEFORE UPDATE ON public.peak_surcharge_windows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Fee audit log ============
CREATE TABLE public.fee_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL, -- 'delivery_area' | 'peak_window'
  entity_id uuid,
  action text NOT NULL, -- 'insert' | 'update' | 'delete'
  old_values jsonb,
  new_values jsonb,
  changed_by uuid,
  changed_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.fee_audit_log TO authenticated;
GRANT ALL ON public.fee_audit_log TO service_role;

ALTER TABLE public.fee_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read fee audit log"
  ON public.fee_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_fee_audit_log_created ON public.fee_audit_log (created_at DESC);
CREATE INDEX idx_fee_audit_log_entity ON public.fee_audit_log (entity_type, entity_id);

-- ============ current_peak_surcharge() helper ============
CREATE OR REPLACE FUNCTION public.current_peak_surcharge()
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_local timestamptz := now() AT TIME ZONE 'Africa/Johannesburg';
  v_dow smallint;
  v_time time;
  v_total numeric := 0;
BEGIN
  v_dow := EXTRACT(DOW FROM v_local)::smallint;
  v_time := v_local::time;

  SELECT COALESCE(SUM(flat_amount), 0) INTO v_total
  FROM public.peak_surcharge_windows
  WHERE is_active = true
    AND (day_of_week IS NULL OR day_of_week = v_dow)
    AND (
      (start_time <= end_time AND v_time >= start_time AND v_time < end_time)
      OR
      (start_time > end_time AND (v_time >= start_time OR v_time < end_time))
    );

  RETURN COALESCE(v_total, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_peak_surcharge() TO anon, authenticated, service_role;

-- ============ Patch find_nearest_zone to include the surcharge ============
CREATE OR REPLACE FUNCTION public.find_nearest_zone(
  p_lat double precision,
  p_lng double precision,
  p_restaurant_lat double precision DEFAULT NULL,
  p_restaurant_lng double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_zone RECORD;
  v_pricing_distance double precision;
  v_fee numeric;
  v_surcharge numeric;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RETURN jsonb_build_object('found', false, 'reason', 'missing_coords');
  END IF;

  SELECT da.id, da.name, da.suburb, da.radius_km,
         da.base_fee, da.price_per_km, da.min_fee, da.max_fee,
         da.delivery_fee,
         public.distance_km(da.lat, da.lng, p_lat, p_lng) AS distance_km
  INTO v_zone
  FROM public.delivery_areas da
  WHERE da.is_active = true
    AND da.lat IS NOT NULL
    AND da.lng IS NOT NULL
    AND public.distance_km(da.lat, da.lng, p_lat, p_lng) <= da.radius_km
  ORDER BY public.distance_km(da.lat, da.lng, p_lat, p_lng) ASC
  LIMIT 1;

  IF v_zone.id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'reason', 'out_of_range');
  END IF;

  IF p_restaurant_lat IS NOT NULL AND p_restaurant_lng IS NOT NULL THEN
    v_pricing_distance := public.distance_km(p_restaurant_lat, p_restaurant_lng, p_lat, p_lng);
  ELSE
    v_pricing_distance := v_zone.distance_km;
  END IF;

  v_fee := public.calc_zone_fee(
    v_zone.base_fee, v_zone.price_per_km, v_zone.min_fee, v_zone.max_fee,
    v_pricing_distance
  );

  v_surcharge := public.current_peak_surcharge();

  RETURN jsonb_build_object(
    'found', true,
    'zone_id', v_zone.id,
    'zone_name', v_zone.name,
    'suburb', v_zone.suburb,
    'radius_km', v_zone.radius_km,
    'distance_km', v_zone.distance_km,
    'pricing_distance_km', v_pricing_distance,
    'base_fee', v_zone.base_fee,
    'price_per_km', v_zone.price_per_km,
    'min_fee', v_zone.min_fee,
    'max_fee', v_zone.max_fee,
    'peak_surcharge', v_surcharge,
    'delivery_fee', v_fee + COALESCE(v_surcharge, 0)
  );
END;
$$;

-- ============ Audit triggers ============
CREATE OR REPLACE FUNCTION public.write_fee_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_entity text;
  v_email text;
BEGIN
  IF TG_TABLE_NAME = 'delivery_areas' THEN
    v_entity := 'delivery_area';
  ELSIF TG_TABLE_NAME = 'peak_surcharge_windows' THEN
    v_entity := 'peak_window';
  ELSE
    v_entity := TG_TABLE_NAME;
  END IF;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_email := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.fee_audit_log (entity_type, entity_id, action, new_values, changed_by, changed_by_email)
    VALUES (v_entity, NEW.id, 'insert', to_jsonb(NEW), auth.uid(), v_email);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.fee_audit_log (entity_type, entity_id, action, old_values, new_values, changed_by, changed_by_email)
    VALUES (v_entity, NEW.id, 'update', to_jsonb(OLD), to_jsonb(NEW), auth.uid(), v_email);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.fee_audit_log (entity_type, entity_id, action, old_values, changed_by, changed_by_email)
    VALUES (v_entity, OLD.id, 'delete', to_jsonb(OLD), auth.uid(), v_email);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_delivery_areas
  AFTER INSERT OR UPDATE OR DELETE ON public.delivery_areas
  FOR EACH ROW EXECUTE FUNCTION public.write_fee_audit();

CREATE TRIGGER trg_audit_peak_windows
  AFTER INSERT OR UPDATE OR DELETE ON public.peak_surcharge_windows
  FOR EACH ROW EXECUTE FUNCTION public.write_fee_audit();
