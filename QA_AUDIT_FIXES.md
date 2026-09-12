# QA Audit Fixes — 2026-09-12

This file documents every change made in response to the full-app QA audit.
All fixes are additive/corrective — no redesign, no renamed tables, no
breaking API changes for anything that was already working correctly.

## How to deploy

1. **Database:** apply `supabase/migrations/20260912120000_qa_audit_fixes.sql`
   the same way you apply any other migration (`supabase db push`, or via the
   Lovable/Supabase migration pipeline). It only uses `CREATE OR REPLACE
   FUNCTION` and constraint swaps — safe to run on a live database, no data
   loss, no table rewrites.
2. **Edge function:** redeploy `supabase/functions/dispatch-tick` (one query
   changed).
3. **Frontend:** rebuild/redeploy as normal — three files changed, all
   backward compatible.

No environment variables, secrets, or Supabase project settings need to change.

---

## 1. CRITICAL — Wallet credits were deducted but never subtracted from the amount charged
**Fixed in:** `supabase/migrations/20260912120000_qa_audit_fixes.sql` → `spend_customer_credits`

Previously the function drained the customer's wallet balance and recorded
`orders.credits_applied`, but never touched `orders.total` — and Yoco's
checkout amount is read straight from `orders.total`. Net effect: customers
were charged the *full* price by card **and** had wallet credits deducted for
nothing.

**Fix:** the function now also does `orders.total = orders.total - v_spend`,
locks the order row (`FOR UPDATE`) to avoid races, refuses to spend credits on
an order that's already paid, and caps the spend so it can never exceed what's
still owed (protects against double-calls/retries pushing the total negative).

## 2. CRITICAL — Orders skipped the restaurant confirm/prepare step entirely
**Fixed in:** same migration → `confirm_online_payment`

Previously, the instant a customer paid, the order jumped straight to
`status = 'ready'` and a driver was dispatched immediately — regardless of the
restaurant's `approval_mode`. The Restaurant Dashboard's entire
`confirmed → preparing → ready` workflow, its "Accept Order"/"Start
Preparing" buttons, and its "NEW" order badge were all dead code, since no
order ever actually reached `pending`/`confirmed`/`preparing`.

**Fix:** `confirm_online_payment` now transitions paid orders to `'confirmed'`
instead of `'ready'`. This required no change to the dispatch logic in
`supabase/functions/_shared/yoco.ts` — that file already had a branch for
"don't dispatch yet, notify the restaurant instead" keyed off
`new_status !== 'ready'`; it just never fired because the status was
hardcoded. The restaurant's existing "Start Preparing → Ready for Pickup"
buttons (`src/pages/RestaurantDashboard.tsx`) already call
`dispatch_assign_next` the moment an order is marked `ready`, so the driver
hand-off now happens at the right point in the flow for every approval mode.

**Also fixed in `src/pages/RestaurantDashboard.tsx`:** the "New Orders" badge
count and the pulsing "NEW" card highlight were keyed on `status === "pending"`
(a status that's never actually set). Both now also match `status ===
"confirmed"`, so restaurants are correctly alerted to freshly-paid orders.

## 3. HIGH — No recovery if the customer's delivery PIN was lost on refresh
**Fixed in:** `src/pages/OrderConfirmation.tsx`

The confirmation page read `order.delivery_code` straight from the database,
but that column is always `NULL` after order creation (a trigger hashes it
immediately). The only way the customer ever saw the real PIN was a
client-side cache (localStorage / React Router navigation state) — which is
wiped by the Yoco payment redirect (a full page reload) or on any other
device.

**Fix:** replaced the static, DB-driven PIN block with the existing
`DeliveryPinCard` component (already used on `src/pages/Orders.tsx`), which
fetches the live PIN via the `get_active_delivery_pin` RPC and has a working
"Resend PIN" button (`regenerate_delivery_pin`) if it's missing. Removed the
now-unused `KeyRound` icon import.

## 4. HIGH — No protection against a fast double-tap creating duplicate paid orders
**Fixed in:** `src/components/CheckoutDialog.tsx`

`handleCheckout` only disabled its button via React state, which doesn't
close the window between two clicks landing before a re-render. `useRef`
state does close that window.

**Fix:** the exported `handleCheckout` is now a thin wrapper with a
synchronous `submittingRef` guard; the original logic was renamed to
`handleCheckoutInner` and runs inside a `try { … } finally { … }` so the guard
always resets, including on every early-return validation failure.

## 5. HIGH — Restaurant order-status updates had no error handling or transition guard
**Fixed in:** `src/pages/RestaurantDashboard.tsx` → `updateOrderStatus`

The raw `.update({ status }).eq("id", orderId)` call never checked its
`error`, so a failed/blocked write left the UI showing a status that was
never actually saved — and nothing stopped a restaurant from pushing an
already-`delivered`/`cancelled`/`rejected` order back to an earlier status.

**Fix:** the function now (a) refuses to touch orders already in a terminal
state, (b) adds an optimistic-lock `.eq("status", oldStatus)` so a stale click
can't silently overwrite a status someone else already changed, (c) reads
back the affected rows and surfaces a toast + re-fetch if the write didn't
land, and (d) surfaces the Postgres error message directly instead of
swallowing it.

## 5b. HIGH (found during re-verification) — Restaurant "Cancel" button was silently non-functional
**Fixed in:** `supabase/migrations/20260912130000_qa_audit_fixes_part2.sql`

While double-checking fix #5 above, found that the RLS policy governing
restaurant order updates never actually allowed `status = 'cancelled'` in its
`WITH CHECK` list. The dashboard's "Cancel" button (next to "Start
Preparing"/"Ready for Pickup") has therefore always been rejected at the
database level — and because the *original* code never checked the update's
`error` (see #5), that rejection was completely invisible: the UI showed the
order as cancelled while it stayed active in the database. The error-handling
fix in #5 would only have surfaced this as a visible error toast; it wouldn't
have fixed the underlying cause.

**Fix:** the RLS policy now allows `'cancelled'` as a valid restaurant-set
status. Also tightened the policy's `USING` clause to exclude orders already
in a terminal state (`delivered`/`cancelled`/`rejected`) at the database
level — the same rule fix #5 already enforces client-side, now backstopped
server-side so a direct API call can't bypass it.

## 6. MEDIUM — `order_messages` rejected the `restaurant` sender role that RLS already permits
**Fixed in:** migration → `order_messages` CHECK constraint

The table's original CHECK constraint only allowed `sender_role IN
('customer', 'driver')`; later RLS policies were extended to permit
`'restaurant'` but the constraint was never updated. Fixed by dynamically
locating and replacing the constraint to include all three roles.

## 7. MEDIUM — Stuck-order escalation in `dispatch-tick` matched a status that no longer occurs
**Fixed in:** `supabase/functions/dispatch-tick/index.ts`

The 15-minute no-driver escalation queried `status = 'pending'`, but orders
looking for a driver actually sit at `status = 'ready'` with
`dispatch_phase IN ('offer_a','offer_b','waiting')`. Query (and the
follow-up guarded update) corrected to match the real dispatch state.

## 8. LOW — Admin cancellation only auto-flagged refunds for one specific case
**Fixed in:** migration → `admin_cancel_order`

Previously only cancellations of a `no_driver_found` + online-paid order
auto-set `refund_status = 'pending'`. Broadened to: any order with
`payment_status = 'paid'` being cancelled by an admin, regardless of which
status it was in.

---

## Verified correct, no change needed
- `restaurant_decide_availability`, `driver_accept_offer`, `claim_order`,
  `dispatch_assign_next` — all properly row-lock and status-guard against
  race conditions.
- Multi-order support for drivers is genuinely implemented and working.
- `verify_and_complete_delivery` (PIN check) is rate-limited and hash-based.
- The `driver_orders` view correctly masks customer PII until a driver is
  actually assigned.
- Server-side order total recomputation ignores client-submitted prices.
- Yoco webhook handling is idempotent and re-verifies against Yoco's API.
