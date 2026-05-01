-- Customer saved addresses (multiple per user, with labels)
CREATE TABLE public.customer_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT NOT NULL DEFAULT 'Home',
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  area_id UUID,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_addresses_label_check CHECK (char_length(label) BETWEEN 1 AND 40),
  CONSTRAINT customer_addresses_address_check CHECK (char_length(address) BETWEEN 4 AND 400),
  CONSTRAINT customer_addresses_lat_check CHECK (lat BETWEEN -90 AND 90),
  CONSTRAINT customer_addresses_lng_check CHECK (lng BETWEEN -180 AND 180)
);

CREATE INDEX idx_customer_addresses_user ON public.customer_addresses(user_id);
CREATE UNIQUE INDEX idx_customer_addresses_one_default
  ON public.customer_addresses(user_id) WHERE is_default = true;

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own addresses"
  ON public.customer_addresses FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert own addresses"
  ON public.customer_addresses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own addresses"
  ON public.customer_addresses FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own addresses"
  ON public.customer_addresses FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage addresses"
  ON public.customer_addresses FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE TRIGGER trg_customer_addresses_updated_at
  BEFORE UPDATE ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure only one default per user: when a row is set is_default=true, clear others
CREATE OR REPLACE FUNCTION public.enforce_single_default_address()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.customer_addresses
       SET is_default = false
     WHERE user_id = NEW.user_id
       AND id <> NEW.id
       AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_single_default_address
  BEFORE INSERT OR UPDATE OF is_default ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_default_address();

-- If a user has no default and inserts a row, make it default automatically
CREATE OR REPLACE FUNCTION public.auto_default_first_address()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = false AND NOT EXISTS (
    SELECT 1 FROM public.customer_addresses
    WHERE user_id = NEW.user_id AND is_default = true
  ) THEN
    NEW.is_default := true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_default_first_address
  BEFORE INSERT ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.auto_default_first_address();