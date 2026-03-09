
-- Push subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own push subscriptions"
ON public.push_subscriptions FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Push config table (stores VAPID keys)
CREATE TABLE IF NOT EXISTS public.push_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read vapid public key"
ON public.push_config FOR SELECT TO anon, authenticated
USING (key = 'vapid_public_key');

-- Trigger function to call push-notify edge function on order status changes
CREATE OR REPLACE FUNCTION public.notify_order_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM net.http_post(
      url := 'https://kdplufybixfqsqhyixxw.supabase.co/functions/v1/push-notify',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'status', NEW.status,
        'restaurant', NEW.restaurant,
        'total', NEW.total,
        'user_id', NEW.user_id,
        'driver_id', NEW.driver_id,
        'restaurant_id', NEW.restaurant_id,
        'old_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER order_push_notification
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_push();
