---
name: Driver Service Areas
description: Per-driver working radius around a chosen point; mandatory at first login; dispatch and checkout coverage rules
type: feature
---

- Each driver picks a centre point (`service_lat`, `service_lng`) and a `service_radius_km` (default 5, slider 1–20). Optional `service_area_label` for display.
- Stored on `driver_profiles`. Edited from `DriverProfile.tsx` via `DriverServiceArea.tsx` (lazy `AddressMapPicker`).
- **Mandatory at first login (admin-led onboarding)**: `DriverDashboard` shows a full-screen "Welcome! Set your working area" gate (`DriverServiceArea` only) until the driver saves `service_lat`/`service_lng`. Admins viewing as themselves bypass the gate.
- Drivers without `service_lat`/`service_lng` set are **hidden from dispatch** — `dispatch_assign_next` excludes them. Going online is also blocked in `DriverDashboard.toggleOnline` as a defence in depth.
- Dispatch matches the driver's service area against the **customer's** delivery coordinate (`distance_km(driver.service_*, order.customer_*) <= service_radius_km`). The existing 10 km restaurant-pickup constraint still applies as a secondary filter.
- Checkout calls `check_area_coverage(lat, lng)` RPC whenever the customer's coords change. If `covered=false`, an amber non-blocking warning is shown — the customer can still place the order; it sits in dispatch waiting for a driver to come online.
