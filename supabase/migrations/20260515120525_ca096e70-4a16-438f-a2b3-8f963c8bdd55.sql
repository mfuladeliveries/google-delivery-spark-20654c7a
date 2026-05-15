
ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS id_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS profile_photo_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_reason text,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

CREATE OR REPLACE FUNCTION public.admin_set_driver_suspended(
  p_user_id uuid,
  p_suspended boolean,
  p_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  UPDATE public.driver_profiles
  SET is_suspended = COALESCE(p_suspended, false),
      suspended_reason = CASE WHEN p_suspended THEN p_reason ELSE NULL END,
      suspended_at     = CASE WHEN p_suspended THEN now() ELSE NULL END,
      is_online        = CASE WHEN p_suspended THEN false ELSE is_online END,
      updated_at       = now()
  WHERE user_id = p_user_id;
END;
$$;
