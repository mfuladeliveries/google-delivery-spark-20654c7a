-- Restore the Mfula Deliveries admin role
-- Does not change passwords or payment settings.

DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  SELECT id
  INTO admin_user_id
  FROM auth.users
  WHERE lower(email) = lower('mfuladeliveries@gmail.com')
  LIMIT 1;

  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_user_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;
