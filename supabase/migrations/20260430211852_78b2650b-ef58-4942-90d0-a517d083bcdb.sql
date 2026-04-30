-- Link restaurants to a single delivery area
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.delivery_areas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_restaurants_area_id ON public.restaurants(area_id);

-- Activate the 5 seeded areas and ensure all have valid coords (Khayelitsha & Mfuleni were null)
UPDATE public.delivery_areas SET lat = -34.0356, lng = 18.6764 WHERE name = 'Khayelitsha' AND lat IS NULL;
UPDATE public.delivery_areas SET lat = -33.9839, lng = 18.6911 WHERE name = 'Mfuleni' AND lat IS NULL;
UPDATE public.delivery_areas SET is_active = true WHERE name IN ('Khayelitsha','Mfuleni','Atlantis','Malmesbury','Delft');