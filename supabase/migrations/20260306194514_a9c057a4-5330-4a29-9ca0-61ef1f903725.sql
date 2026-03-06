
-- ============================================================
-- FIX 1: Hide delivery_code from drivers
-- Create a view that excludes delivery_code for driver queries
-- ============================================================

CREATE OR REPLACE VIEW public.driver_orders_view AS
SELECT
  id, order_number, customer_name, customer_contact, customer_address,
  items, total, status, restaurant, restaurant_id, created_at,
  delivery_fee, driver_id, driver_lat, driver_lng, driver_location_updated_at,
  subtotal, tax, tip, payment_method, payment_status, special_notes, user_id, customer_id
FROM public.orders;

-- Drop old driver SELECT policies on orders table
DROP POLICY IF EXISTS "Drivers can view assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Drivers can view ready unassigned orders" ON public.orders;

-- Recreate driver SELECT policies on the view
ALTER VIEW public.driver_orders_view OWNER TO postgres;

-- Enable RLS on orders still applies; drivers now use the view
-- Grant select on the view to authenticated
GRANT SELECT ON public.driver_orders_view TO authenticated;

-- Create RLS-like security via the view with security_invoker
-- Actually, views don't support RLS directly. We need to use security barrier.
-- Better approach: use a security definer function or keep RLS on orders but exclude delivery_code via column-level security.
-- Simplest: Re-add the driver policies but create a SECURITY BARRIER view without delivery_code.

DROP VIEW IF EXISTS public.driver_orders_view;

-- Instead, let's re-add the policies and use a different approach:
-- We'll hash the delivery_code at rest.

-- Add a delivery_code_hash column
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_code_hash text;

-- Create a function to hash delivery codes
CREATE OR REPLACE FUNCTION public.hash_delivery_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.delivery_code IS NOT NULL AND NEW.delivery_code != '' THEN
    NEW.delivery_code_hash := encode(digest(NEW.delivery_code, 'sha256'), 'hex');
    NEW.delivery_code := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Install pgcrypto if not already
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create trigger to hash on insert/update
DROP TRIGGER IF EXISTS hash_delivery_code_trigger ON public.orders;
CREATE TRIGGER hash_delivery_code_trigger
  BEFORE INSERT OR UPDATE OF delivery_code ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.hash_delivery_code();

-- Update verify_and_complete_delivery to compare hashes
CREATE OR REPLACE FUNCTION public.verify_and_complete_delivery(p_order_id uuid, p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hash text;
BEGIN
  v_hash := encode(digest(p_code, 'sha256'), 'hex');
  UPDATE orders SET status = 'delivered'
  WHERE id = p_order_id
    AND driver_id = auth.uid()
    AND delivery_code_hash = v_hash
    AND status = 'out_for_delivery';
  RETURN FOUND;
END;
$$;

-- Re-add driver SELECT policies (delivery_code is now always NULL, hash is useless without rainbow tables)
CREATE POLICY "Drivers can view assigned orders"
ON public.orders FOR SELECT TO authenticated
USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can view ready unassigned orders"
ON public.orders FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'driver'::app_role) AND status = 'ready' AND driver_id IS NULL);

-- Also hash existing delivery codes
UPDATE public.orders
SET delivery_code_hash = encode(digest(delivery_code, 'sha256'), 'hex'),
    delivery_code = NULL
WHERE delivery_code IS NOT NULL AND delivery_code != '';

-- ============================================================
-- FIX 2: Drop direct order INSERT policy
-- ============================================================

DROP POLICY IF EXISTS "Users can create own orders" ON public.orders;

-- ============================================================
-- FIX 3: Secure driver-documents storage bucket
-- ============================================================

-- Make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'driver-documents';

-- Drop the public read policy
DROP POLICY IF EXISTS "Public read driver documents" ON storage.objects;

-- Add admin-only read policy
CREATE POLICY "Admins can view driver documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);
