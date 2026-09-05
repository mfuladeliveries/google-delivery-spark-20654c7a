-- 1. Audit / request table for PIN overrides
CREATE TABLE public.delivery_pin_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id uuid,
  driver_name text NOT NULL DEFAULT '',
  customer_name text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT 'Customer did not receive delivery PIN',
  status text NOT NULL DEFAULT 'requested',
  approved_by uuid,
  approved_by_email text,
  admin_notes text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_pin_overrides_status_chk
    CHECK (status IN ('requested','approved','rejected','used'))
);

CREATE INDEX idx_delivery_pin_overrides_order ON public.delivery_pin_overrides(order_id);
CREATE INDEX idx_delivery_pin_overrides_status ON public.delivery_pin_overrides(status);

GRANT SELECT ON public.delivery_pin_overrides TO authenticated;
GRANT ALL ON public.delivery_pin_overrides TO service_role;

ALTER TABLE public.delivery_pin_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers view their own override requests"
ON public.delivery_pin_overrides FOR SELECT TO authenticated
USING (driver_id = auth.uid());

CREATE POLICY "Admins view all override requests"
ON public.delivery_pin_overrides FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_delivery_pin_overrides_updated_at
BEFORE UPDATE ON public.delivery_pin_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Regenerate a delivery PIN (customer or admin) and return the plain PIN
CREATE OR REPLACE FUNCTION public.regenerate_delivery_pin(p_order_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_order public.orders;
  v_pin text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF NOT (
    v_order.user_id = auth.uid()
    OR v_order.customer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF v_order.status IN ('delivered','cancelled','rejected') THEN
    RAISE EXCEPTION 'This order is already closed.';
  END IF;

  v_pin := lpad((100000 + floor(random() * 900000))::int::text, 6, '0');

  UPDATE public.orders
  SET delivery_code = NULL,
      delivery_code_hash = encode(extensions.digest(v_pin, 'sha256'), 'hex'),
      admin_delivery_code = v_pin,
      pin_attempts = 0
  WHERE id = p_order_id;

  RETURN v_pin;
END;
$$;

REVOKE ALL ON FUNCTION public.regenerate_delivery_pin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerate_delivery_pin(uuid) TO authenticated;

-- 3. Customer/admin can read the currently active plain PIN (if one exists)
CREATE OR REPLACE FUNCTION public.get_active_delivery_pin(p_order_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order public.orders;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF NOT (
    v_order.user_id = auth.uid()
    OR v_order.customer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF v_order.status IN ('delivered','cancelled','rejected') THEN
    RETURN NULL;
  END IF;

  RETURN v_order.admin_delivery_code;
END;
$$;

REVOKE ALL ON FUNCTION public.get_active_delivery_pin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_delivery_pin(uuid) TO authenticated;

-- 4. Driver triggers a fresh PIN for the customer WITHOUT seeing it
CREATE OR REPLACE FUNCTION public.driver_resend_customer_pin(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_status text;
  v_user_id uuid;
  v_pin text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT status, user_id INTO v_status, v_user_id
  FROM public.orders
  WHERE id = p_order_id AND driver_id = auth.uid()
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Order not found or not assigned to you';
  END IF;

  IF v_status <> 'out_for_delivery' THEN
    RAISE EXCEPTION 'This order is not out for delivery.';
  END IF;

  v_pin := lpad((100000 + floor(random() * 900000))::int::text, 6, '0');

  UPDATE public.orders
  SET delivery_code = NULL,
      delivery_code_hash = encode(extensions.digest(v_pin, 'sha256'), 'hex'),
      admin_delivery_code = v_pin,
      pin_attempts = 0
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'customer_user_id', v_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.driver_resend_customer_pin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_resend_customer_pin(uuid) TO authenticated;

-- 5. Driver requests admin assistance
CREATE OR REPLACE FUNCTION public.driver_request_pin_override(p_order_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order public.orders;
  v_driver_name text;
  v_existing uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND driver_id = auth.uid();

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found or not assigned to you';
  END IF;

  IF v_order.status <> 'out_for_delivery' THEN
    RAISE EXCEPTION 'This order is not out for delivery.';
  END IF;

  SELECT id INTO v_existing
  FROM public.delivery_pin_overrides
  WHERE order_id = p_order_id AND status IN ('requested','approved')
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT full_name INTO v_driver_name FROM public.profiles WHERE user_id = auth.uid();

  INSERT INTO public.delivery_pin_overrides
    (order_id, driver_id, driver_name, customer_name, reason, status)
  VALUES
    (p_order_id, auth.uid(), COALESCE(v_driver_name,''), COALESCE(v_order.customer_name,''),
     'Customer did not receive delivery PIN', 'requested')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.driver_request_pin_override(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_request_pin_override(uuid) TO authenticated;

-- 6. Admin approves / rejects
CREATE OR REPLACE FUNCTION public.admin_decide_pin_override(
  p_request_id uuid,
  p_approve boolean,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  UPDATE public.delivery_pin_overrides
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      approved_by = auth.uid(),
      approved_by_email = v_email,
      admin_notes = p_notes,
      decided_at = now()
  WHERE id = p_request_id
    AND status = 'requested';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already decided';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_decide_pin_override(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_decide_pin_override(uuid, boolean, text) TO authenticated;

-- 7. Driver completes delivery only when an admin approved the override
CREATE OR REPLACE FUNCTION public.driver_complete_with_override(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_req uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT o.id INTO v_req
  FROM public.orders o
  WHERE o.id = p_order_id AND o.driver_id = auth.uid() AND o.status = 'out_for_delivery';

  IF v_req IS NULL THEN
    RAISE EXCEPTION 'Order not found or not out for delivery';
  END IF;

  SELECT id INTO v_req
  FROM public.delivery_pin_overrides
  WHERE order_id = p_order_id AND driver_id = auth.uid() AND status = 'approved'
  ORDER BY decided_at DESC NULLS LAST
  LIMIT 1;

  IF v_req IS NULL THEN
    RAISE EXCEPTION 'Admin approval required before completing without a PIN.';
  END IF;

  UPDATE public.orders
  SET status = 'delivered', delivered_at = now()
  WHERE id = p_order_id AND driver_id = auth.uid() AND status = 'out_for_delivery';

  UPDATE public.delivery_pin_overrides
  SET status = 'used', used_at = now()
  WHERE id = v_req;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.driver_complete_with_override(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_complete_with_override(uuid) TO authenticated;

-- 8. Let drivers see the override state for their own orders via a helper
CREATE OR REPLACE FUNCTION public.driver_pin_override_status(p_order_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT status INTO v_status
  FROM public.delivery_pin_overrides
  WHERE order_id = p_order_id
    AND driver_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.driver_pin_override_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_pin_override_status(uuid) TO authenticated;