---
name: Coordinate Validation
description: Strict GPS validation for delivery addresses — autocomplete-only entry, map confirmation, server-side enforcement
type: feature
---

Delivery addresses MUST come from a verified geocoder source — plain typed text is never accepted.

## Client (CheckoutDialog)
- Address input uses `AddressAutocomplete` (Nominatim, country-biased to ZA, 350ms debounce, 24h localStorage cache).
- Typing alone clears any previously selected coords and sets `addressVerified = false`.
- "Pick on map & confirm location" button opens `AddressMapPicker` (lazy-loaded) for manual pin + reverse-geocode + Confirm.
- Place Order is disabled unless `addressVerified && coords && !outOfRange`.
- Per-restaurant 8 km radius (`MAX_DELIVERY_KM = 8`) calculated client-side using Haversine vs the restaurant's saved lat/lng.
- Profile address is NOT prefilled on checkout — user must always pick again to guarantee fresh, valid coords.

## Server (`create_verified_order` RPC)
- Rejects null, zero, or out-of-range (-90..90 / -180..180) lat/lng with errcode 22023.
- Re-runs the per-restaurant 8 km check using `public.distance_km(...)`. Tampered client coords are rejected.
- Logs every rejection to `public.invalid_order_attempts` (admin-only readable) with reason: `invalid_coords`, `outside_service_area`, or `too_far_from_restaurant`.

## Provider
OpenStreetMap Nominatim (free, no API key). Used by both `AddressAutocomplete` (forward search) and `AddressMapPicker` (reverse geocode).
