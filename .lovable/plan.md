

## Real-Time Order Dispatch System — Implementation Plan

### Current State Analysis

The existing codebase has partial infrastructure:
- **CheckoutDialog** inserts orders but does NOT set `restaurant_id` — orders can't be routed to restaurants
- **RestaurantDashboard** has realtime subscriptions and a generic "advance status" button, but no Accept/Reject flow
- **DriverDashboard** already shows `ready` orders and handles delivery acceptance
- **OrderNotifications** only notifies customers, not restaurants or drivers

### What Needs to Change

#### 1. Database Migration
- Add `payment_status` column (text, default `'pending'`) to `orders` table
- No schema change needed for new statuses (`rejected`) since `status` is already a text column

#### 2. CheckoutDialog — Route Orders to Restaurants
- Before inserting, look up `restaurant_id` from the `restaurants` table by matching the restaurant name from cart items
- Set `restaurant_id`, `customer_id` (same as `user_id`), and `payment_status` on the order insert
- This is the critical fix that enables the entire dispatch pipeline

#### 3. RestaurantDashboard — Accept/Reject Flow
- For `pending` orders, show explicit **Accept Order** and **Reject Order** buttons instead of the generic status-advance button
- Accept → sets status to `confirmed` then restaurant can advance through `preparing` → `ready`
- Reject → sets status to `rejected`
- Add an audio chime + toast when a new order arrives via realtime
- Filter realtime subscription to only this restaurant's orders using `restaurant_id`

#### 4. DriverDashboard — Minor Enhancements
- Already functional: shows `ready` unassigned orders, driver can accept (sets `driver_id` + status to `out_for_delivery`)
- Add audio notification when new jobs appear
- Add estimated distance display (text placeholder since we don't have a routing API)

#### 5. OrderNotifications — Multi-Role Notifications
- Extend to detect user role and subscribe to relevant events:
  - **Restaurant role**: listen for new `INSERT` events on orders matching their `restaurant_id`
  - **Driver role**: listen for orders changing to `ready` status
  - **Customer role**: existing behavior (listen for `UPDATE` on their orders)
- Show role-appropriate toast messages and browser notifications

#### 6. Orders Page (Customer) — Status Updates
- Add `rejected` status to `statusConfig` with appropriate icon/color
- Customer sees rejection notification via the existing realtime subscription

### Files to Modify

| File | Change |
|------|--------|
| `supabase/migrations/` | Add `payment_status` column |
| `src/components/CheckoutDialog.tsx` | Resolve `restaurant_id` from name, set on insert |
| `src/pages/RestaurantDashboard.tsx` | Accept/Reject buttons, audio alert, filtered realtime |
| `src/pages/DriverDashboard.tsx` | Audio alert for new jobs |
| `src/components/OrderNotifications.tsx` | Multi-role notification subscriptions |
| `src/pages/Orders.tsx` | Add `rejected` status config |

### Security

All existing RLS policies already handle the access patterns:
- Restaurant owners can only SELECT/UPDATE their own orders (via `restaurant_id` → `restaurants.owner_user_id`)
- Drivers can only see `ready` unassigned orders or their assigned orders
- Customers can only see their own orders
- The `rejected` status flows through existing policies without changes

