---
name: Driver Service Areas
description: Admin-managed delivery_areas (name + suburb) replace per-driver radius. Each driver picks one area; dispatch matches via orders.address_tag (exact equality) instead of substring matching.
type: feature
---
- Table `delivery_areas` (id, name, suburb, is_active) — admin CRUD via AdminDeliveryAreas tab in AdminDashboard.
- `driver_profiles.service_area_id` references the chosen area (one per driver).
- `orders.address_tag` (text) stores the canonical `delivery_areas.name` matched at order creation time. Indexed.
- Helper `derive_address_tag(p_address)` returns the best-matching active area name (prefers name match over suburb; longest match wins).
- `create_verified_order` calls `derive_address_tag` and stamps `address_tag` on the inserted row.
- `dispatch_assign_next` matches drivers via `delivery_areas.name = orders.address_tag` (exact). If `address_tag` is NULL it tries to derive once and persist; if still NULL the order goes to `waiting` (no fuzzy fallback). Restaurant-distance 10 km soft preference still applies for ranking.
- `check_area_coverage(p_lat, p_lng, p_address)` derives the tag from the address and reports coverage by exact tag match against online drivers' chosen areas. Returns `address_tag` in payload.
- Drivers must pick an area before going online; gate enforced in DriverDashboard. Picker UI is in `src/components/driver/DriverServiceArea.tsx` (Area tab) — list of admin areas, single-select, confirm dialog.
- Old per-driver fields (service_lat, service_lng, service_radius_km, service_area_label) still exist in the column set but are no longer used by dispatch or UI.
