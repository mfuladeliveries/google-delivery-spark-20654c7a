CREATE TABLE IF NOT EXISTS public.order_notification_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  user_id UUID NOT NULL,
  notification_kind TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (order_id, user_id, notification_kind)
);

CREATE INDEX IF NOT EXISTS idx_order_notification_log_lookup
  ON public.order_notification_log (order_id, user_id, notification_kind);

ALTER TABLE public.order_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view notification log"
  ON public.order_notification_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));