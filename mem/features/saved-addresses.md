---
name: Saved Addresses
description: Customer address book — multiple labeled saved delivery addresses (Home/Work/Other) with default auto-fill at checkout
type: feature
---

## Data
Table `customer_addresses` (label, address, lat, lng, area_id, is_default).
- DB triggers enforce one default per user, and auto-mark first-saved as default.
- Strict RLS: customers manage own; admins read/manage all.

## UX
- **Profile page**: `<SavedAddressManager />` lists all addresses with Set-default / Edit / Delete actions and an Add button.
- **Checkout**: chip picker above the autocomplete shows all saved addresses; default is auto-filled when CheckoutDialog opens (overrides the previous "always re-confirm" rule). Picking a chip sets verified coords without going through Nominatim.
- **Save-for-next-time**: when a user picks a fresh in-range address, a "Save this for next time" toggle + label chips (Home/Work/Other or custom) appears. On successful checkout, the address is inserted into `customer_addresses`.
- All add/edit flows reuse `AddressAutocomplete` + `AddressMapPicker` — pure typing never produces coords (autocomplete-only rule preserved).

## Validation copy
- "Please select a valid address from the list." when verified=false.
- "Sorry, we do not deliver to this location yet." when out of zone (uses existing `OUT_OF_ZONE_MESSAGE`).
