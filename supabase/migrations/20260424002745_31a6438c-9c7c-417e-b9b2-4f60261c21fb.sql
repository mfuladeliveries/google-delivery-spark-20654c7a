ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS opens_at time,
  ADD COLUMN IF NOT EXISTS closes_at time;