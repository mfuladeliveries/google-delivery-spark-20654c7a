---
name: Location Gating
description: Live GPS gating, 8km per-restaurant delivery radius, nearby-first sorting on home, GPS sanity check
type: feature
---

- Live GPS via `useGeoLocation` with profile-coords fallback.
- `DELIVERY_RADIUS_KM = 8` — per-restaurant radius used everywhere (home "nearby" badge, RestaurantMenu order gate, Checkout, server RPC). Label constant `DELIVERY_RADIUS_LABEL_KM = 8` matches.
- **GPS sanity check**: if browser GPS reports a position more than 8 km from the customer's saved profile address, the reading is rejected and we silently fall back to the saved address (status = "fallback"). Guards against VPN / wifi-positioning errors. Applied to both initial fix and `watchPosition` updates. If the user has no saved address, GPS is always trusted.
- Home page sorts nearby restaurants first, then by distance, then rating.
- RestaurantMenu blocks Add to Cart / Checkout if distance > 8 km or restaurant has no coords.
