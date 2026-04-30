-- 1. Delivery areas table (admin-managed)
CREATE TABLE public.delivery_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  suburb text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE UNIQUE INDEX delivery_areas_name_unique ON public.delivery_areas (lower(name));

ALTER TABLE public.delivery_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active delivery areas"
  ON public.delivery_areas FOR SELECT
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert delivery areas"
  ON public.delivery_areas FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update delivery areas"
  ON public.delivery_areas FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete delivery areas"
  ON public.delivery_areas FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_delivery_areas_updated_at
  BEFORE UPDATE ON public.delivery_areas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add service_area_id to driver_profiles
ALTER TABLE public.driver_profiles
  ADD COLUMN service_area_id uuid REFERENCES public.delivery_areas(id) ON DELETE SET NULL;

CREATE INDEX driver_profiles_service_area_id_idx ON public.driver_profiles(service_area_id);

-- 3. Replace dispatch_assign_next to match by chosen delivery area (name/suburb in customer address)
CREATE OR REPLACE FUNCTION public.dispatch_assign_next(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_next_driver uuid;
  v_previous_driver uuid;
  v_new_phase text;
  v_offer_seconds integer := 180;
  v_max_km numeric := 10;
  v_rest_lat double precision;
  v_rest_lng double precision;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status NOT IN ('ready') OR v_order.driver_id IS NOT NULL THEN
    RETURN jsonb_build_object('phase', v_order.dispatch_phase, 'reason', 'not_dispatchable');
  END IF;

  v_previous_driver := v_order.offered_to_driver_id;

  IF v_previous_driver IS NOT NULL THEN
    UPDATE public.orders
    SET missed_by_driver_ids = array_append(COALESCE(missed_by_driver_ids, ARRAY[]::uuid[]), v_previous_driver)
    WHERE id = p_order_id
      AND NOT (v_previous_driver = ANY(COALESCE(missed_by_driver_ids, ARRAY[]::uuid[])));
    v_order.missed_by_driver_ids := array_append(COALESCE(v_order.missed_by_driver_ids, ARRAY[]::uuid[]), v_previous_driver);
  END IF;

  IF v_order.dispatch_phase IS NULL THEN
    v_new_phase := 'offer_a';
  ELSIF v_order.dispatch_phase = 'offer_a' THEN
    v_new_phase := 'offer_b';
  ELSE
    v_new_phase := 'waiting';
  END IF;

  IF v_order.restaurant_id IS NOT NULL THEN
    SELECT lat, lng INTO v_rest_lat, v_rest_lng
    FROM public.restaurants WHERE id = v_order.restaurant_id;
  END IF;

  IF v_new_phase IN ('offer_a', 'offer_b') THEN
    -- Match by admin-defined delivery area: the driver's chosen area
    -- name or suburb must appear in the customer's address (case-insensitive).
    SELECT dp.user_id INTO v_next_driver
    FROM public.driver_profiles dp
    JOIN public.delivery_areas da ON da.id = dp.service_area_id AND da.is_active = true
    WHERE dp.is_online = true
      AND dp.service_area_id IS NOT NULL
      AND v_order.customer_address IS NOT NULL
      AND (
        position(lower(da.name) IN lower(v_order.customer_address)) > 0
        OR (da.suburb <> '' AND position(lower(da.suburb) IN lower(v_order.customer_address)) > 0)
      )
      AND NOT (dp.user_id = ANY(COALESCE(v_order.missed_by_driver_ids, ARRAY[]::uuid[])))
      AND NOT EXISTS (
        SELECT 1 FROM public.orders o2
        WHERE o2.driver_id = dp.user_id
          AND o2.status IN ('driver_assigned','picking_up','arrived_at_restaurant','out_for_delivery')
      )
      AND (
        v_rest_lat IS NULL OR v_rest_lng IS NULL
        OR dp.current_lat IS NULL OR dp.current_lng IS NULL
        OR public.distance_km(v_rest_lat, v_rest_lng, dp.current_lat, dp.current_lng) <= v_max_km
      )
    ORDER BY
      CASE WHEN v_rest_lat IS NOT NULL AND dp.current_lat IS NOT NULL
           THEN public.distance_km(v_rest_lat, v_rest_lng, dp.current_lat, dp.current_lng)
           ELSE 9999 END ASC,
      dp.location_updated_at DESC NULLS LAST
    LIMIT 1;

    IF v_next_driver IS NULL THEN
      v_new_phase := 'waiting';
    END IF;
  END IF;

  IF v_new_phase IN ('offer_a','offer_b') THEN
    UPDATE public.orders SET
      offered_to_driver_id = v_next_driver,
      offer_expires_at = now() + make_interval(secs => v_offer_seconds),
      dispatch_phase = v_new_phase,
      dispatch_started_at = COALESCE(dispatch_started_at, now())
    WHERE id = p_order_id;
  ELSE
    UPDATE public.orders SET
      offered_to_driver_id = NULL,
      offer_expires_at = NULL,
      dispatch_phase = 'waiting',
      dispatch_started_at = COALESCE(dispatch_started_at, now())
    WHERE id = p_order_id;
  END IF;

  RETURN jsonb_build_object(
    'phase', v_new_phase,
    'offered_to', v_next_driver,
    'previous_driver', v_previous_driver
  );
END;
$function$;