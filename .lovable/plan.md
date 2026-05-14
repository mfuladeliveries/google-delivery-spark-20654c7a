## Goal
For restaurants with the **🛎️ Restaurant Confirms Orders** toggle enabled, the customer cannot pay until the restaurant confirms it can fulfil the order. Restaurants without the toggle keep the current pay-first flow.

## New status
- `awaiting_restaurant` — order created, payment not initiated, waiting on restaurant decision.
- After restaurant accepts → moves to existing `pending_payment` (customer can pay).
- After restaurant rejects → existing `rejected`.

## Flow comparison

```text
Confirm-required (NEW):
  customer places order
    → awaiting_restaurant
    → restaurant: Confirm | Reject
        Confirm → pending_payment → customer pays → ready → dispatch
        Reject  → rejected (no charge)

No confirmation (UNCHANGED):
  customer places order → pending_payment → pays → ready → dispatch
```

## Changes

### Database (migration)
- `create_verified_order`: when the restaurant has `requires_confirmation = true`, insert the order as `status='awaiting_restaurant'`, payment_status='pending', and skip `payment_initiated_at`. Return the new status in the JSON result so the client knows whether to redirect to PayFast or to the wait screen.
- New RPC `restaurant_decide_availability(p_order_id, p_accept boolean, p_reason text)` — owner-of-restaurant or admin only. Accept → `pending_payment` + sets `payment_initiated_at = now()`. Reject → `rejected` with reason.
- `confirm_payfast_payment`: when restaurant pre-confirmed (i.e. `requires_confirmation = true`), set `new_status = 'ready'` after successful payment instead of `'pending'`. Drivers can be dispatched immediately because the restaurant has already accepted.
- `auto_cancel_stale_orders`: include `awaiting_restaurant` so orders abandoned before the restaurant responds are auto-cleaned after 12h.

### Restaurant dashboard (`src/pages/RestaurantDashboard.tsx`)
- Show `awaiting_restaurant` orders with two buttons: **Confirm Availability** and **Reject**, plus a yellow "⏳ Awaiting your confirmation — customer cannot pay yet" banner.
- Both buttons call the new RPC and send a push to the customer (`status: 'awaiting_payment'` for accept, `'rejected'` for reject).
- Add `awaiting_restaurant` to the status filter chips and counts.

### Checkout (`src/components/CheckoutDialog.tsx`)
- After `create_verified_order`, branch on the returned `status`:
  - `awaiting_restaurant` → toast "Waiting for the restaurant to confirm…" and navigate to `/order-confirmation/<num>` (no PayFast yet).
  - `pending_payment` → existing PayFast handoff.

### Customer order screen (`src/pages/OrderConfirmation.tsx`)
- Recognise the new `awaiting_restaurant` state: show a "⏳ Waiting for restaurant to confirm" card and keep polling.
- When status flips to `pending_payment`, show a prominent **Pay Now** button that navigates to `/pay/payfast` with the same nav state Checkout used.
- When status flips to `rejected`, show a "Restaurant could not accept your order — no charge was made" message.

### Orders list (`src/pages/Orders.tsx`)
- Render the same `awaiting_restaurant` / pending-payment-after-confirm cues so customers can resume payment from the list.

### Edge functions
- `payfast-create-payment` continues to require `pending_payment` — no change needed because acceptance flips the status before the customer reaches PayFast.
- `payfast-itn` already only dispatches when `new_status === 'ready'`, so once `confirm_payfast_payment` returns `'ready'` for pre-confirmed orders, dispatch fires automatically.

## Notifications
- Restaurant push when a new `awaiting_restaurant` order arrives (reuse the existing pending push pipeline with a different label).
- Customer push when the restaurant accepts ("Restaurant confirmed — tap to pay") or rejects ("Restaurant couldn't accept your order").

## Out of scope
- Auto-expiry of `awaiting_restaurant` shorter than the 12h global cleanup (can be added later if needed).
- Any change to cash-on-delivery (online payment is already the only supported method).