
CREATE TABLE public.order_rejections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('declined','timeout')),
  dispatch_phase text CHECK (dispatch_phase IN ('offer_a','offer_b','broadcast','waiting')),
  rejected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX order_rejections_order_id_idx ON public.order_rejections(order_id);
CREATE INDEX order_rejections_driver_id_idx ON public.order_rejections(driver_id);
CREATE INDEX order_rejections_rejected_at_idx ON public.order_rejections(rejected_at DESC);

GRANT SELECT, INSERT ON public.order_rejections TO authenticated;
GRANT ALL ON public.order_rejections TO service_role;

ALTER TABLE public.order_rejections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can insert their own rejections"
  ON public.order_rejections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers can read their own rejections"
  ON public.order_rejections FOR SELECT
  TO authenticated
  USING (auth.uid() = driver_id);

CREATE POLICY "Admins can read all rejections"
  ON public.order_rejections FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
