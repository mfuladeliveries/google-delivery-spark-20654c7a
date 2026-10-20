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