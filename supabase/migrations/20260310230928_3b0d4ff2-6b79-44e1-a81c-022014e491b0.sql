
DROP TRIGGER IF EXISTS order_push_notification ON public.orders;
DROP FUNCTION IF EXISTS public.notify_order_push() CASCADE;
