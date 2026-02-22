
-- Add delivery verification code to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_code text DEFAULT '';

-- Add driver location tracking columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS driver_lat double precision DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS driver_lng double precision DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS driver_location_updated_at timestamp with time zone DEFAULT NULL;

-- Allow drivers to view orders that are ready and unassigned (for job board)
CREATE POLICY "Drivers can view ready unassigned orders"
ON public.orders
FOR SELECT
USING (
  has_role(auth.uid(), 'driver'::app_role) 
  AND status = 'ready' 
  AND driver_id IS NULL
);
