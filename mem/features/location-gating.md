---
name: Location Gating
description: Live GPS gating, 8km per-restaurant delivery radius, nearby-first sorting on home
type: feature
---

- Live GPS via `useGeoLocation` with profile-coords fallback.
- `DELIVERY_RADIUS_KM = 8` — per-restaurant radius used everywhere (home "nearby" badge, RestaurantMenu order gate, Checkout, server RPC). Label constant `DELIVERY_RADIUS_LABEL_KM = 8` matches.
- Home page sorts nearby restaurants first, then by distance, then rating.
- RestaurantMenu blocks Add to Cart / Checkout if distance > 8 km or restaurant has no coords.
