# Restaurants organised by delivery area (brands + branches)

## Goal
One card per restaurant brand (e.g. KFC), with separate branches per area. A customer confirms their area, sees only restaurants that have an active branch in that area, and the order is automatically tied to that area's branch (its address, coordinates, delivery fee and driver navigation).

## What the customer will see
1. On the home screen the area is detected from their location, with a picker to change/confirm it (remembered for next visit).
2. Only brands with an active, delivery-enabled branch in that area are listed — one card per brand, never duplicates.
3. Opening a restaurant shows the branch for their area (branch name, address, hours). Distance, delivery fee and the driver's pickup point all use that branch.
4. If a brand has no branch in the area, it simply doesn't appear.

## What the admin will get
A new "Branches" panel inside Admin → Restaurants for each restaurant:
- Add/edit branches: area, branch name, address, coordinates (map pin), active toggle, delivery on/off, optional opening/closing time and days.
- See at a glance which areas each restaurant serves.
- Existing delivery-area management stays as it is.

## Data changes (no data loss)
- New table `restaurant_locations`: restaurant, area, branch name, address, lat/lng, active, delivery_enabled, optional opens_at/closes_at/operating_days, timestamps.
- Backfill: every existing restaurant gets one branch built from its current area, address and coordinates, so nothing breaks on day one.
- `restaurants` keeps all its current columns (menus, images, hours, ratings stay untouched); brand-level fields remain the source of truth for logo/description/cuisine.
- `orders` gains a nullable `restaurant_location_id` so each order records which branch it came from. Existing orders keep working unchanged.
- Menus stay on the brand — no menu duplication. Per-branch availability/price overrides are left as a future extension point.

## Technical notes
- Migration: create `restaurant_locations` (FKs to `restaurants`, `delivery_areas`), GRANTs (anon read of active branches, authenticated read, admin/owner write, service_role all), RLS policies, `updated_at` trigger, indexes on `(area_id, active)` and `(restaurant_id)`; backfill from `restaurants`; add `orders.restaurant_location_id`.
- `create_verified_order` gains `p_restaurant_location_id`: validates the branch belongs to the restaurant, is active and delivery-enabled, and uses branch coordinates for the 8 km radius check and fee distance; falls back to restaurant coords when no branch is supplied. All existing validation, dedupe, option pricing and PIN logic preserved.
- `get-catalog` edge function returns `restaurant_locations` alongside restaurants and areas; `src/lib/catalog.ts` types extended.
- New `src/lib/restaurantAreas.ts`: pick the branch for a given area, group locations by restaurant, expose effective coords/hours per branch.
- `src/pages/Index.tsx`: replace the hardcoded Mfuleni area filter with the selected/confirmed area; filter by "has an active branch in this area"; one card per brand using the resolved branch for distance and gating. Area picker component with persisted choice.
- `src/pages/RestaurantMenu.tsx`, `src/pages/Search.tsx`, `src/components/CheckoutDialog.tsx`: carry the resolved branch through to fee calculation and order creation.
- Admin: new `src/components/admin/RestaurantBranches.tsx` wired into the Restaurants tab, reusing the existing map picker and address autocomplete.
- Dispatch/driver navigation uses the order's branch coordinates when present, otherwise the restaurant's.
