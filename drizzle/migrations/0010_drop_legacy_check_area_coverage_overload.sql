-- Remove the legacy 2-argument check_area_coverage overload.
-- PostgREST cannot disambiguate between the 2-arg and 3-arg (defaulted) versions,
-- so every RPC call fails with PGRST203 and clients retry in a loop (screen flicker).
-- The 3-argument zone-based version (with default p_address) handles all callers.
DROP FUNCTION IF EXISTS public.check_area_coverage(double precision, double precision);

-- Re-assert grants on the remaining 3-argument function.
GRANT EXECUTE ON FUNCTION public.check_area_coverage(double precision, double precision, text) TO anon, authenticated;