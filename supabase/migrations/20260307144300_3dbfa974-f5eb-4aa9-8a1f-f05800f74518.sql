-- Drop the existing overly permissive restaurant update policy
DROP POLICY IF EXISTS "Restaurant owners can update order status" ON orders;

-- Recreate with WITH CHECK to restrict allowed statuses
CREATE POLICY "Restaurant owners can update order status"
ON orders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM restaurants r
    WHERE r.id = orders.restaurant_id AND r.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  status IN ('confirmed', 'preparing', 'ready', 'rejected')
);