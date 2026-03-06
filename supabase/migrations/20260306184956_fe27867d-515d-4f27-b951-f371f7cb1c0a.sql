
-- Add payment_method to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash';

-- Create driver_profiles table for online status, documents, earnings
CREATE TABLE IF NOT EXISTS public.driver_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  is_online boolean NOT NULL DEFAULT false,
  vehicle_type text NOT NULL DEFAULT '',
  license_plate text NOT NULL DEFAULT '',
  id_document_url text NOT NULL DEFAULT '',
  license_url text NOT NULL DEFAULT '',
  total_earnings numeric NOT NULL DEFAULT 0,
  total_deliveries integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;

-- Drivers can view/update their own profile
CREATE POLICY "Drivers can view own profile" ON public.driver_profiles
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Drivers can update own profile" ON public.driver_profiles
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Drivers can insert own profile" ON public.driver_profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage driver profiles" ON public.driver_profiles
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Auto-create driver profile when driver role is assigned
CREATE OR REPLACE FUNCTION public.handle_new_driver_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'driver' THEN
    INSERT INTO public.driver_profiles (user_id)
    VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_driver_role_created ON public.user_roles;
CREATE TRIGGER on_driver_role_created
  AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_driver_profile();

-- Update earnings when delivery is completed
CREATE OR REPLACE FUNCTION public.update_driver_earnings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' AND NEW.driver_id IS NOT NULL THEN
    UPDATE driver_profiles
    SET total_earnings = total_earnings + NEW.delivery_fee,
        total_deliveries = total_deliveries + 1,
        updated_at = now()
    WHERE user_id = NEW.driver_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_delivered ON public.orders;
CREATE TRIGGER on_order_delivered
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_driver_earnings();

-- Enable realtime for driver_profiles
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_profiles;
