# KFC page stability
- [ ] Stop GPS updates briefly clearing the KFC branch; verify the real signed-in customer menu stays stable during small location updates and still switches areas strictly.

# Paid order cancellation
- [x] Add the exact warning immediately before payment and paid-order status; remove customer cancel after verified payment. Align refund policy and remove customer-issued wallet/bank refund controls.
- [x] Apply approved live cancellation safeguards across both customer RPCs and order writes; preserve administrator exceptions and service payment workflows. Disable customer refund execution and prevent 12-hour automatic cancellation of paid orders. Live function/trigger/grant readback confirmed.
- [x] Pass 28 tests including live anonymous cancellation denial, customer refund denial and admin-only exception checks. Signed-in live account has no orders; controlled desktop/mobile warning, unpaid/paid UI checks pass without runtime errors or overflow. Latest preview build OK; no charges or existing order mutations.
- [ ] Verify a real pending/failed cancellation, paid-order RPC/direct-write denial, administrator exception and full Yoco payment return end-to-end — requires appropriate test orders and authorized administrator session; no real payment was made.

# Restaurant locations
- [x] Fix reproduced cart distance/fee lookup using brand coordinates instead of the area's branch. Shared area-specific pickup lookup; 47 tests pass, preview build OK, signed-in KFC Delft bucket cart warning removed and checkout opens on mobile without placing an order or charging.
- [x] Apply strict branch-area matching to all restaurant brands in home/search/menu/checkout, choose nearest branch with customer coordinates, and block incomplete/invalid admin GPS entries. Preserve companion shopping and payment logic. Signed-in Delft GPS detection/search verified; 54 focused tests passed.
- [ ] Populate missing branches/areas only from verified locations with approval for live data changes; never use area-centre placeholders.
- [x] Expose Locations & coordinates on each Admin restaurant; reuse existing per-area branch records and customer-location selection without database changes.
- [ ] Verify live Admin location save — requires authorized admin session and approved verified location data; customer Delft branch browsing verified without live mutations.

# Approval-to-payment workflow
- [x] Check live approval RPC and scheduled timeout: acceptance sets pending_payment; existing 30-minute payment expiry runs every five minutes. Audit Yoco confirmation/retry/notifications without live mutations.
- [x] Add customer pending-payment recovery on acceptance/reopening and show saved prices, delivery/service fees, discounts/credits and total; rejected orders do not redirect.
- [x] Require persisted paid confirmation for customer success; add retry navigation. Fourteen focused tests pass, preview builds, signed-in empty-orders/nonexistent-order checks pass, and simulated acceptance/reopening/rejection/retry browser flows pass without runtime errors.
- [x] User approved targeted live safeguards. Applied service-only checkout leases, crash-stable retry keys, confirmation transaction guards and durable payment notification queue; added customer/restaurant/admin alerts and paid-only verification. Preserved credentials, configured mode and existing timeout; no publishing or real charges.
- [x] Pass 21 focused tests and one Deno checkout safety test; latest preview build OK. Confirm new live tables use RLS and payment helper execution is service-role-only. Existing dispatch scheduler recovers ready orders after interrupted post-payment handoff.
- [ ] Verify real approval-to-payment, provider checkout concurrency/retry and role notification delivery end-to-end — blocked by currently unreachable Cloud database and failed authorized session mint; earlier simulated checks are not real payment verification. Final live function rollout/readback and anonymous/customer access-isolation checks remain unverified while Cloud is inaccessible.

# Restaurant login and orders
- [x] Add a clear restaurant login within the same app, retaining admin-led account setup.
- [x] Improve restaurant order decisions, loading feedback, navigation, refresh and sign-out without changing payments.
- [x] Pass four focused tests and browser checks for restaurant login and protected-route redirects; preview build passes.
- [x] Restaurant portal brief: reject now requires a chosen/typed reason (dialog + tests); new Kitchen tab lets owners open/close the kitchen, pause orders and set operating hours/days (uses existing is_open/opens_at/closes_at/operating_days columns — no migration needed); header shows live Open/Closed badge.
- [ ] Verify real restaurant sign-in, assigned restaurant visibility, order accept/preparing/ready readback and kitchen-status save — blocked by unreachable Cloud database and failed authorized session mint; no orders or payments changed.

# KFC menu pictures
- [x] Match existing KFC products to permitted official pictures or neutral placeholders (official reuse permission unavailable).
- [x] Update only KFC image fields using existing storage.
- [x] Verify unchanged menu records and customer picture loading on mobile (84 available items load; 11 unavailable records retain their status; stored image accessible for all 95). Existing KFC items have no customization detail flow to exercise.

# Steers South Africa
- [x] Inspect official menu, image rights and current restaurant/branch records.
- [x] Save 65 nonduplicate Steers products with labelled category illustrations; block unverified prices in the customer menu and order validation.
- [x] Reuse existing Delft/Melkbos delivery-area branches and admin editing/upload/hide controls; add explicit price confirmation.
- [x] Verify all 65 saved images load in the customer menu on phones/desktop; pending-price Add buttons disabled, no horizontal overflow, no runtime errors.
- [ ] Confirm branch prices and run a real Steers cart/checkout flow — blocked by missing branch-confirmed prices (0 verified).
- [ ] Activate a Mfuleni Steers branch — blocked by missing confirmed branch coordinates/assignment; existing Mfuleni branch remains inactive, not substituted with Delft.

# Burger King South Africa
- [x] Check official King Value menu and advertised prices; reuse the existing Burger King restaurant and Blue Downs branch.
- [x] Save 16 missing products and fill 4 existing zero prices with sourced reference prices; preserve existing positive prices and block unconfirmed prices.
- [x] Verify all 20 King Value entries and prices on phones, disabled ordering, no overflow/runtime errors, 11 passing price/branch tests, and unchanged other-restaurant data digest.
- [ ] Confirm Blue Downs delivery prices before enabling the 20 King Value products — blocked by missing branch confirmation.

# App testing
- [x] Run 88 automated tests and customer browsing/address/menu/cart checks without placing orders or changing payments; fix reproduced auth loading deadlock.
- [x] Check signed-in customer navigation and document unavailable privileged-role checks in QA_PERMISSION_AUDIT.md.
- [ ] Exercise driver/admin/restaurant signed-in screens — blocked by unavailable approved privileged-role sessions.

# Data API permission readiness
- [x] Inspect 43 live public tables, grants, RLS, policies and migration history; test reachable Data API endpoints.
- [x] Apply two least-privilege permission migrations and preserve role/row controls.
- [x] Pass three anonymous/customer read-isolation tests; document harness build/reset/Git limitations in QA_PERMISSION_AUDIT.md.
- [ ] Verify driver/admin write isolation — blocked by unavailable approved privileged-role sessions.
- [ ] Certify clean reset/preview branches and full exposure settings — blocked by an isolated reset environment and unavailable hosted settings read; pre-existing migration-history blockers documented.

# Daily running-credit dashboard
- [x] Collect Oct 15–21 UTC recorded snapshots for backend, functions, storage and traffic; Oct 21 labelled partial.
- [x] Store the snapshot behind admin-only access and add daily charts, totals, date filters and CSV download.
- [x] Verify aggregation and live anonymous/customer/admin read isolation (7 focused tests); real admin dashboard, date filters, download and phone layout passed with no overflow or runtime errors. No orders or payments changed.