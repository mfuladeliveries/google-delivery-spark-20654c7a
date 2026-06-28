
-- 1) Hide owner_user_id from anon on restaurants via column-level grants
REVOKE SELECT ON public.restaurants FROM anon;
REVOKE SELECT ON public.restaurants FROM authenticated;

GRANT SELECT (
  id, name, description, logo, location, cuisine, rating, delivery_time,
  min_order, is_active, created_at, lat, lng, logo_url, banner_url,
  gallery_images, opens_at, closes_at, contact_number, operating_days,
  is_open, total_reviews, image_url, area_id, requires_confirmation,
  approval_mode, confirmation_timeout_minutes
) ON public.restaurants TO anon;

-- Authenticated users still need owner_user_id (owners read their own row, admins read all)
GRANT SELECT ON public.restaurants TO authenticated;

-- 2) Extend is_order_participant to include restaurant owners
CREATE OR REPLACE FUNCTION public.is_order_participant(_order_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE o.id = _order_id
      AND (
        o.user_id = _user_id
        OR o.customer_id = _user_id
        OR o.driver_id = _user_id
        OR r.owner_user_id = _user_id
      )
  );
$function$;

-- Replace INSERT policy to allow restaurant sender_role
DROP POLICY IF EXISTS "Participants send order messages" ON public.order_messages;
CREATE POLICY "Participants send order messages"
ON public.order_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND is_order_participant(order_id, auth.uid())
  AND (
    (sender_role = 'customer' AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_messages.order_id
        AND (o.user_id = auth.uid() OR o.customer_id = auth.uid())
    ))
    OR (sender_role = 'driver' AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_messages.order_id AND o.driver_id = auth.uid()
    ))
    OR (sender_role = 'restaurant' AND EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.restaurants r ON r.id = o.restaurant_id
      WHERE o.id = order_messages.order_id AND r.owner_user_id = auth.uid()
    ))
  )
);

-- 3) Restrictive policy: drivers cannot SELECT from orders directly
CREATE POLICY "Block direct driver SELECT on orders"
ON public.orders
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  NOT has_role(auth.uid(), 'driver'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR auth.uid() = user_id
  OR auth.uid() = customer_id
  OR EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = orders.restaurant_id AND r.owner_user_id = auth.uid()
  )
);
