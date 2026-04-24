ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS has_cuts boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cuts jsonb NOT NULL DEFAULT '[]'::jsonb;