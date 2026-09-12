-- ============================================================================
-- QA AUDIT FOLLOW-UP FIX (2026-09-12, part 2)
--
-- Discovered while re-verifying the "restaurant order-status update" fix in
-- 20260912120000_qa_audit_fixes.sql: the RLS policy governing restaurant
-- order-status updates never included 'cancelled' in its WITH CHECK list.
--
-- src/pages/RestaurantDashboard.tsx has always had a "Cancel" button
-- (X icon, next to "Start Preparing" / "Ready for Pickup") that calls
-- updateOrderStatus(order.id, "cancelled"). Because the RLS policy rejects
-- any UPDATE that sets status to 'cancelled', that button has always failed
-- at the database level -- and because the *original* frontend code never
-- checked the update call's `error`, the failure was invisible: the UI
-- optimistically showed the order as cancelled while the database still had
-- it active. (The error-handling fix already shipped in
-- 20260912120000_qa_audit_fixes.sql would have surfaced this as a visible
-- error toast, but doesn't fix the root cause -- this migration does.)
--
-- While here, also tighten the USING clause so a restaurant can't mutate an
-- order that's already reached a terminal state, closing the same gap at
-- the database level that the frontend guard in updateOrderStatus already
-- closes client-side (defense in depth -- a client-side check alone doesn't
-- stop a direct API call).
-- ============================================================================

DROP POLICY IF EXISTS "Restaurant owners can update order status" ON public.orders;

CREATE POLICY "Restaurant owners can update order status"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = orders.restaurant_id AND r.owner_user_id = auth.uid())
  AND orders.status NOT IN ('delivered', 'cancelled', 'rejected')
)
WITH CHECK (
  status IN ('confirmed', 'preparing', 'ready', 'rejected', 'pending_payment', 'awaiting_restaurant', 'cancelled')
);
