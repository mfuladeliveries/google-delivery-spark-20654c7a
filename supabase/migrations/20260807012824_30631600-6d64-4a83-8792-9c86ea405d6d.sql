CREATE TABLE public.order_policy_acceptances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  terms_version text NOT NULL,
  delivery_policy_version text NOT NULL,
  refund_policy_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_policy_acceptances_order ON public.order_policy_acceptances(order_id);

GRANT SELECT, INSERT ON public.order_policy_acceptances TO authenticated;
GRANT ALL ON public.order_policy_acceptances TO service_role;

ALTER TABLE public.order_policy_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can record their own policy acceptance"
  ON public.order_policy_acceptances FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Customers can view their own policy acceptance"
  ON public.order_policy_acceptances FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all policy acceptances"
  ON public.order_policy_acceptances FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));