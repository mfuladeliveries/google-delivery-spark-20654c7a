---
name: Delivery Pricing
description: Per-zone dynamic delivery fee = base + (km from restaurant × per-km), clamped by optional min/max
type: feature
---
Each `delivery_areas` row has: `base_fee`, `price_per_km`, `min_fee` (nullable), `max_fee` (nullable), `radius_km`.
Formula: `clamp(base + per_km × dist(restaurant, customer), min, max)` — distance from restaurant lat/lng to customer; falls back to zone-centre if restaurant coords missing.
DB helpers: `calc_zone_fee()`, `find_nearest_zone(lat,lng,rest_lat,rest_lng)`, public RPC `calc_delivery_fee(lat,lng,restaurant_name)`.
Authoritative fee is computed inside `create_verified_order` — client preview is informational.
Constraints: non-negative fees, `min ≤ max`, unique `lower(name)` to prevent duplicate areas.
Out-of-zone error: "Delivery is not available in your area yet."
