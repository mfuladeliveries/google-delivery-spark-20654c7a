---
name: Driver Service Areas
description: Admin-managed delivery_areas. Each driver picks one area on driver_profiles.service_area_id; a trigger mirrors it into driver_service_areas (which dispatch reads). Customers get a "no driver available" push when no driver covers their area.
type: feature
---
- Table `delivery_areas` (id, name, suburb, lat, lng, radius_km, is_active) — admin CRUD via AdminDeliveryAreas.
- Driver picks ONE area in `DriverServiceArea.tsx`, written to `driver_profiles.service_area_id`.
- DB trigger `trg_sync_driver_service_area` mirrors any change of `driver_profiles.service_area_id` into the `driver_service_areas` join table (delete old row, insert new). The join table is what dispatch joins on, so the picker UI never has to write it directly.
- `dispatch_assign_next` resolves the order's zone via `find_nearest_zone(customer_lat, customer_lng)` and matches online drivers via `driver_service_areas.area_id = zone_id`. If no matching driver after offer_a/offer_b → phase becomes `waiting`.
- When `dispatch_assign_next` returns phase `waiting`, the client (`dispatchAndNotify`) sends two pushes: `dispatch_broadcast` (any online driver) + `no_driver_available` (customer).
- `dispatch-tick` also sends `no_driver_available` to the customer for every order that escalates to broadcast.
- `push-notify` handles `status = "no_driver_available"`: targets the customer (`user_id` or resolved from order), uses dedupe kind `customer_no_driver_available` so only one push per order.
- `address_tag` on orders stores the resolved zone name for grouping/UI.
