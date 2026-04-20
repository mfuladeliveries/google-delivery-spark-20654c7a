
CREATE TABLE public.driver_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  CONSTRAINT driver_access_requests_status_check CHECK (status IN ('pending','approved','rejected','cancelled'))
);

-- Only one pending request per user
CREATE UNIQUE INDEX driver_access_requests_one_pending_per_user
  ON public.driver_access_requests (user_id)
  WHERE status = 'pending';

ALTER TABLE public.driver_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own requests"
  ON public.driver_access_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own requests"
  ON public.driver_access_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Users cancel own pending requests"
  ON public.driver_access_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status IN ('pending','cancelled'));

CREATE POLICY "Admins view all requests"
  ON public.driver_access_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage requests"
  ON public.driver_access_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete requests"
  ON public.driver_access_requests FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Approve helper: grants the driver role and marks the request approved
CREATE OR REPLACE FUNCTION public.admin_approve_driver_request(p_request_id uuid, p_notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins may approve driver access requests';
  END IF;

  SELECT user_id INTO v_user_id
  FROM public.driver_access_requests
  WHERE id = p_request_id AND status = 'pending';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  -- Grant driver role (idempotent)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'driver'::app_role)
  ON CONFLICT DO NOTHING;

  -- Ensure a driver_profile row exists so the driver dashboard works
  INSERT INTO public.driver_profiles (user_id)
  VALUES (v_user_id)
  ON CONFLICT DO NOTHING;

  UPDATE public.driver_access_requests
  SET status = 'approved',
      admin_notes = COALESCE(p_notes, admin_notes),
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      updated_at = now()
  WHERE id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_driver_request(p_request_id uuid, p_notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins may reject driver access requests';
  END IF;

  UPDATE public.driver_access_requests
  SET status = 'rejected',
      admin_notes = COALESCE(p_notes, admin_notes),
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      updated_at = now()
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_approve_driver_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_driver_request(uuid, text) TO authenticated;
