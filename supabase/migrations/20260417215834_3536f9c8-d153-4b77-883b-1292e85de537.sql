
-- 1. Tighten food-images storage policies: require ownership of the restaurant
-- Path convention: {restaurant_id}/{filename}
DROP POLICY IF EXISTS "Restaurant owners and admins can upload food images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant owners and admins can update food images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant owners and admins can delete food images" ON storage.objects;

CREATE POLICY "Restaurant owners can upload to their food images folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'food-images'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.owner_user_id = auth.uid()
        AND r.id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE POLICY "Restaurant owners can update their food images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'food-images'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.owner_user_id = auth.uid()
        AND r.id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE POLICY "Restaurant owners can delete their food images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'food-images'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.owner_user_id = auth.uid()
        AND r.id::text = (storage.foldername(name))[1]
    )
  )
);

-- 2. Explicitly block self-assignment of roles by non-admins (defense-in-depth)
-- The existing "Admins can manage roles" ALL policy already restricts inserts,
-- but adding an explicit restrictive policy makes the intent unambiguous.
CREATE POLICY "Block non-admin role inserts"
ON public.user_roles AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Block non-admin role updates"
ON public.user_roles AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Block non-admin role deletes"
ON public.user_roles AS RESTRICTIVE
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Realtime channel authorization: scope realtime.messages to authenticated only
-- and ensure broadcasts respect table RLS via realtime authorization
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can receive realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated users can receive realtime messages"
ON realtime.messages FOR SELECT TO authenticated
USING (
  -- Postgres-changes broadcasts on these tables already enforce row RLS
  -- via the supabase realtime authorization layer; restrict channel reads
  -- to authenticated users so anonymous clients cannot subscribe.
  (SELECT auth.role()) = 'authenticated'
);
