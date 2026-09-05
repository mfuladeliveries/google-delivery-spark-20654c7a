CREATE OR REPLACE FUNCTION public.order_sender_role_valid(_order_id uuid, _user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE o.id = _order_id
      AND (
        (_role = 'customer' AND (o.user_id = _user_id OR o.customer_id = _user_id))
        OR (_role = 'driver' AND o.driver_id = _user_id)
        OR (_role = 'restaurant' AND r.owner_user_id = _user_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.order_sender_role_valid(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_sender_role_valid(uuid, uuid, text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Participants send order messages" ON public.order_messages;
CREATE POLICY "Participants send order messages"
ON public.order_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.order_sender_role_valid(order_id, auth.uid(), sender_role)
);