-- Orders are created only by the verified-order RPC; no direct client insert policy exists.
REVOKE INSERT ON public.orders FROM authenticated;
-- Driver rows may be created/repaired or updated, never deleted directly by clients.
REVOKE DELETE ON public.driver_profiles FROM authenticated;
-- Rejected job records only require read/insert in current driver workflows.
REVOKE UPDATE, DELETE ON public.driver_rejected_orders FROM authenticated;
-- Publish only active surcharge windows; administrators retain the existing ALL policy.
ALTER POLICY "Anyone can read active peak windows" ON public.peak_surcharge_windows USING (is_active = true);
NOTIFY pgrst, 'reload schema';