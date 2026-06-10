
-- 1) Hide owner_user_id from anonymous visitors via column-level grants.
REVOKE SELECT ON public.restaurants FROM anon;
GRANT SELECT (
  id, name, description, logo, location, cuisine, rating, delivery_time,
  min_order, is_active, created_at, lat, lng, logo_url, banner_url,
  gallery_images, opens_at, closes_at, contact_number, operating_days,
  is_open, total_reviews, image_url, area_id, requires_confirmation,
  approval_mode, confirmation_timeout_minutes
) ON public.restaurants TO anon;

-- 2) Rate-limit check_email_verified to make enumeration infeasible.
CREATE OR REPLACE FUNCTION public.check_email_verified(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_confirmed_at timestamptz;
  v_email text;
  v_key text;
begin
  if p_email is null or length(trim(p_email)) = 0 then
    return json_build_object('exists', false, 'confirmed', false);
  end if;

  -- Throttle: 5 lookups per minute per email, plus 30 per minute per caller IP-less key.
  v_key := lower(trim(p_email));
  if not public.check_rate_limit('email_check:' || v_key, 'check_email_verified', 5, 60) then
    raise exception 'Too many requests. Please try again shortly.' using errcode = '42901';
  end if;

  select email, email_confirmed_at
  into v_email, v_confirmed_at
  from auth.users
  where lower(email) = v_key
  limit 1;

  if v_email is null then
    return json_build_object('exists', false, 'confirmed', false);
  end if;

  return json_build_object('exists', true, 'confirmed', v_confirmed_at is not null);
end;
$function$;

-- 3) Allow drivers to delete their own files in the private driver-documents bucket.
DROP POLICY IF EXISTS "Drivers can delete own documents" ON storage.objects;
CREATE POLICY "Drivers can delete own documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4) Fix mutable search_path on the email-queue helper functions.
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
