
-- Fix 1: Create a secure view for driver job board that hides PII
CREATE VIEW public.driver_job_board WITH (security_invoker = true) AS
  SELECT id, order_number, restaurant, customer_address, total, delivery_fee, created_at, items
  FROM orders
  WHERE status = 'ready' AND driver_id IS NULL;

-- Fix 2: Make driver-documents bucket private and drop public read policy
UPDATE storage.buckets SET public = false WHERE id = 'driver-documents';
DROP POLICY IF EXISTS "Public read driver documents" ON storage.objects;
