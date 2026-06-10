---
name: Delivery Fee Management
description: Peak-time surcharges (flat ZAR) added on top of zone fee + audit log for all fee changes
type: feature
---
Admin tab "fees" → `AdminFeeManagement.tsx`.

- `peak_surcharge_windows`: label, day_of_week (NULL = every day, 0=Sun..6=Sat), start_time, end_time, flat_amount, is_active. Active windows stack.
- `current_peak_surcharge()` RPC: sums active windows evaluated in Africa/Johannesburg. Callable by anon.
- `find_nearest_zone` now returns `delivery_fee` already INCLUDING the surcharge, plus a separate `peak_surcharge` field. `create_verified_order` inherits this automatically — no other server changes needed.
- Client preview: `CheckoutDialog` calls `current_peak_surcharge` on open + every 60s and shows it as its own line ("Peak-time surcharge +Rx") above the total.
- `fee_audit_log` + `write_fee_audit` trigger on `delivery_areas` and `peak_surcharge_windows` records insert/update/delete with old→new jsonb, changed_by, email. Admins only can read.
