---
name: Restaurant Area Assignment
description: Restaurants belong to one delivery area; customers only see restaurants from the area their location falls in
type: feature
---

- `restaurants.area_id` (uuid, nullable) → `delivery_areas.id` (ON DELETE SET NULL).
- Admin assigns one area per restaurant via dropdown in Admin → Restaurants (both create form and inline edit panel). Save uses a direct supabase update.
- Customer Index page (`src/pages/Index.tsx`):
  - Loads active zones via `getActiveZones()` and computes `currentZone = findNearestZone(lat, lng, zones)` from effective coords (manual override > GPS > saved profile).
  - Filters restaurants strictly: `r.area_id === currentZone.zone.id`. If no coords → show all (avoid empty list).
  - Empty states: outside any active area → "Not available in your area yet"; inside area but no restaurants assigned → "No restaurants in {area} yet".
  - Section title becomes "📍 Restaurants in {area name}" when a zone is matched.
- Per-restaurant distance badges + 8 km gating (location-gating memory) still apply on top of area filter.
