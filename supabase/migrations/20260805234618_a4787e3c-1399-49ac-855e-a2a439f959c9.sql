ALTER TABLE public.order_dispatch_log DROP CONSTRAINT IF EXISTS order_dispatch_log_event_check;
ALTER TABLE public.order_dispatch_log ADD CONSTRAINT order_dispatch_log_event_check
  CHECK (event = ANY (ARRAY['offer','offered','timeout','rejected','accepted','round_complete','no_drivers','broadcast']));