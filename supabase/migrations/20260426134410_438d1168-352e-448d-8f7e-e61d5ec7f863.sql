-- Chat messages between customer and assigned driver for an order
CREATE TABLE public.order_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'driver')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_messages_order_id ON public.order_messages(order_id, created_at);
CREATE INDEX idx_order_messages_unread ON public.order_messages(order_id, read_at) WHERE read_at IS NULL;

ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user a participant on this order?
CREATE OR REPLACE FUNCTION public.is_order_participant(_order_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = _order_id
      AND (o.user_id = _user_id OR o.customer_id = _user_id OR o.driver_id = _user_id)
  );
$$;

-- View: customer, assigned driver, or admin
CREATE POLICY "Participants view order messages"
ON public.order_messages
FOR SELECT
TO authenticated
USING (
  public.is_order_participant(order_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Insert: only as yourself, only if you're a participant, with role matching your relationship
CREATE POLICY "Participants send order messages"
ON public.order_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.is_order_participant(order_id, auth.uid())
  AND (
    (sender_role = 'customer' AND EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR o.customer_id = auth.uid())
    ))
    OR (sender_role = 'driver' AND EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.driver_id = auth.uid()
    ))
  )
);

-- Update: only the recipient can mark messages as read (i.e. update read_at on messages they didn't send)
CREATE POLICY "Recipient marks messages read"
ON public.order_messages
FOR UPDATE
TO authenticated
USING (
  sender_id <> auth.uid()
  AND public.is_order_participant(order_id, auth.uid())
)
WITH CHECK (
  sender_id <> auth.uid()
  AND public.is_order_participant(order_id, auth.uid())
);

-- Admin manage
CREATE POLICY "Admins manage order messages"
ON public.order_messages
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Realtime
ALTER TABLE public.order_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;