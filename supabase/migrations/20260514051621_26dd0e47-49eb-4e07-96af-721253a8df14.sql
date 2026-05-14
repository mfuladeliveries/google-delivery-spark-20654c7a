
-- Set admin password and grant admin role for mfuladeliveries@gmail.com
UPDATE auth.users
SET encrypted_password = crypt('17061991M.d', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE id = 'b4911d30-3e35-4551-9105-7f3fa8cb18a6';

INSERT INTO public.user_roles (user_id, role)
VALUES ('b4911d30-3e35-4551-9105-7f3fa8cb18a6', 'admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;
