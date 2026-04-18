-- Track per-driver order rejections so rejected offers don't reappear for that driver
CREATE TABLE public.driver_rejected_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id uuid NOT NULL,
  order_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (driver_id, order_id)
);

CREATE INDEX idx_driver_rejected_orders_driver ON public.driver_rejected_orders(driver_id);
CREATE INDEX idx_driver_rejected_orders_order ON public.driver_rejected_orders(order_id);

ALTER TABLE public.driver_rejected_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view own rejections"
ON public.driver_rejected_orders
FOR SELECT
TO authenticated
USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can insert own rejections"
ON public.driver_rejected_orders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Admins can manage rejections"
ON public.driver_rejected_orders
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Update driver_job_board view consumers can filter on the client; the view itself stays unchanged.