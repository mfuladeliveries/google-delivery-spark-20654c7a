ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_environment text NOT NULL DEFAULT 'live';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_environment_chk'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_payment_environment_chk
      CHECK (payment_environment IN ('live', 'test'));
  END IF;
END $$;

INSERT INTO public.app_settings (key, value)
VALUES ('payment_mode', jsonb_build_object('mode', 'live'))
ON CONFLICT (key) DO NOTHING;