-- Allow anyone to view all restaurants regardless of status
DROP POLICY IF EXISTS "Anyone can view active restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "public_read_restaurants" ON public.restaurants;
CREATE POLICY "public_read_restaurants" ON public.restaurants FOR SELECT USING (true);

-- Address EXPOSED_SENSITIVE_DATA (orders_driver_direct_select):
-- Remove direct SELECT policies on the orders table for drivers
DROP POLICY IF EXISTS "Drivers can view assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Drivers can view targeted offers" ON public.orders;
