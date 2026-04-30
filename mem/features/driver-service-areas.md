---
name: Driver Service Areas
description: Admin-managed delivery_areas (name + suburb) replace per-driver radius. Each driver picks one area; dispatch matches by area name/suburb in customer address.
type: feature
---
- Table `delivery_areas` (id, name, suburb, is_active) — admin CRUD via AdminDeliveryAreas tab in AdminDashboard.
- `driver_profiles.service_area_id` references the chosen area (one per driver).
- `dispatch_assign_next` only offers an order to drivers whose chosen active area's name OR suburb appears (case-insensitive) in `orders.customer_address`. Restaurant-distance 10 km soft preference still applies for ranking.
- `check_area_coverage(p_lat, p_lng, p_address)` reports coverage by matching online drivers' chosen area names/suburbs against the customer's address. CheckoutDialog passes the address.
- Drivers must pick an area before going online; gate enforced in DriverDashboard. Picker UI is in `src/components/driver/DriverServiceArea.tsx` (Area tab) — list of admin areas, single-select, confirm dialog.
- Old per-driver fields (service_lat, service_lng, service_radius_km, service_area_label) still exist in the column set but are no longer used by dispatch or UI.
