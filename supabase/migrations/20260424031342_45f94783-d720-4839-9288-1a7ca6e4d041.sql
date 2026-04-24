-- Order ratings table
CREATE TABLE public.order_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE,
  customer_id uuid NOT NULL,
  driver_id uuid,
  restaurant_id uuid,
  food_rating integer NOT NULL CHECK (food_rating BETWEEN 1 AND 5),
  driver_rating integer CHECK (driver_rating IS NULL OR driver_rating BETWEEN 1 AND 5),
  comment text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_ratings ENABLE ROW LEVEL SECURITY;

-- Customers can manage their own rating
CREATE POLICY "Customers create own rating"
  ON public.order_ratings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers view own rating"
  ON public.order_ratings FOR SELECT TO authenticated
  USING (auth.uid() = customer_id);

CREATE POLICY "Customers update own rating"
  ON public.order_ratings FOR UPDATE TO authenticated
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

-- Drivers see ratings about them
CREATE POLICY "Drivers view own ratings"
  ON public.order_ratings FOR SELECT TO authenticated
  USING (auth.uid() = driver_id);

-- Restaurant owners see ratings on their restaurant
CREATE POLICY "Restaurant owners view their ratings"
  ON public.order_ratings FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = order_ratings.restaurant_id AND r.owner_user_id = auth.uid()
  ));

-- Admins manage all
CREATE POLICY "Admins manage all ratings"
  ON public.order_ratings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Update timestamps trigger
CREATE TRIGGER update_order_ratings_updated_at
  BEFORE UPDATE ON public.order_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Recalc restaurant aggregate rating when a rating is inserted/updated/deleted
CREATE OR REPLACE FUNCTION public.recalc_restaurant_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
  v_avg numeric;
  v_count integer;
BEGIN
  v_restaurant_id := COALESCE(NEW.restaurant_id, OLD.restaurant_id);
  IF v_restaurant_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT ROUND(AVG(food_rating)::numeric, 2), COUNT(*)
  INTO v_avg, v_count
  FROM public.order_ratings
  WHERE restaurant_id = v_restaurant_id;

  UPDATE public.restaurants
  SET rating = COALESCE(v_avg, 4.5),
      total_reviews = COALESCE(v_count, 0)
  WHERE id = v_restaurant_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_recalc_restaurant_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.order_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.recalc_restaurant_rating();

-- Index for lookups
CREATE INDEX idx_order_ratings_restaurant ON public.order_ratings(restaurant_id);
CREATE INDEX idx_order_ratings_driver ON public.order_ratings(driver_id);