-- The driver feed view ran with security_invoker=on, so it inherited the orders
-- RLS policies. Since no policy grants drivers row access (and a restrictive
-- policy blocks them), every driver query silently returned zero rows.
-- Make the view self-filtering and owner-evaluated instead.

DROP VIEW IF EXISTS public.driver_orders;

CREATE VIEW public.driver_orders
WITH (security_invoker = off) AS
SELECT
  o.id,
  o.order_number,
  o.restaurant,
  o.restaurant_id,
  o.items,
  o.special_notes,
  o.tip,
  o.delivery_fee,
  CASE WHEN o.driver_id = auth.uid() THEN o.customer_name ELSE NULL END AS customer_name,
  CASE WHEN o.driver_id = auth.uid() THEN o.customer_contact ELSE NULL END AS customer_contact,
  o.customer_address,
  o.customer_lat,
  o.customer_lng,
  o.status,
  o.created_at,
  o.driver_id,
  o.driver_lat,
  o.driver_lng,
  o.driver_location_updated_at,
  o.accepted_at,
  o.picking_up_at,
  o.arrived_at,
  o.picked_up_at,
  o.delivered_at,
  o.cancelled_at,
  o.cancel_reason,
  o.offered_to_driver_id,
  o.offer_expires_at,
  o.dispatch_phase,
  o.dispatch_round,
  o.dispatch_started_at,
  o.address_tag,
  o.pin_attempts
FROM public.orders o
WHERE auth.uid() IS NOT NULL
  AND (
    o.driver_id = auth.uid()
    OR o.offered_to_driver_id = auth.uid()
    OR (o.driver_id IS NULL AND o.status = 'ready' AND o.dispatch_phase = 'broadcast')
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

REVOKE ALL ON public.driver_orders FROM anon;
GRANT SELECT ON public.driver_orders TO authenticated;
GRANT SELECT ON public.driver_orders TO service_role;