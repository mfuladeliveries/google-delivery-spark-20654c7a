-- Remove the legacy 2-arg find_nearest_zone overload. The 4-arg version
-- (with restaurant coords defaulted to NULL) covers both call shapes and
-- having both made every 2-arg call ambiguous, which made dispatch_assign_next
-- raise an exception and fall through to "broadcast / no driver" instead of
-- targeting the area's online drivers.
DROP FUNCTION IF EXISTS public.find_nearest_zone(double precision, double precision);