
-- Driver-safe projection of orders. security_invoker keeps the existing RLS on orders.
CREATE OR REPLACE VIEW public.driver_orders
WITH (security_invoker = on) AS
SELECT
  id, order_number, restaurant, restaurant_id,
  items, special_notes, tip, delivery_fee,
  customer_name, customer_contact, customer_address,
  customer_lat, customer_lng,
  status, created_at,
  driver_id, driver_lat, driver_lng, driver_location_updated_at,
  accepted_at, picking_up_at, arrived_at, picked_up_at,
  delivered_at, cancelled_at, cancel_reason,
  offered_to_driver_id, offer_expires_at,
  dispatch_phase, dispatch_round, dispatch_started_at,
  address_tag, pin_attempts
FROM public.orders;

REVOKE ALL ON public.driver_orders FROM PUBLIC;
GRANT SELECT ON public.driver_orders TO authenticated;
