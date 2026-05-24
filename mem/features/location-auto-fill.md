---
name: Location Auto Fill
description: Browser Geolocation + Google Maps geocoding/autocomplete via maps-geocode edge function
type: feature
---

- Geocoding (forward, reverse, autocomplete, place details) all go through the `maps-geocode` Supabase edge function, which proxies the Lovable Google Maps Platform connector via the connector gateway. No browser API key required → works on `*.lovable.app` and custom domains.
- Client helpers in `src/lib/geocode.ts`: `geocodeAddress`, `geocodeAddressFull`, `reverseGeocode`, `placeAutocomplete`, `placeDetails`.
- `AddressAutocomplete` uses Places API (New) autocomplete + place details with a per-session token (bills both as one session). Pure text typing never produces coords — selection-only contract is preserved.
- `AddressMapPicker`, `UpdateAddressSheet`, `Profile`, `Index` (GPS reverse-geocode banner) all use the helpers — no direct Nominatim/OSM calls remain in client code.
