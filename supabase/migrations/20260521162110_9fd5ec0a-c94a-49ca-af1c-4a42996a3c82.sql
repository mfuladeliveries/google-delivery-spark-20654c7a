
-- Fix realtime wildcard: deny unmatched topics
DROP POLICY IF EXISTS "Order participants receive realtime messages" ON realtime.messages;
CREATE POLICY "Order participants receive realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'order-chat-%' THEN
      public.is_order_participant(NULLIF(substring(realtime.topic(), 'order-chat-(.*)$'), '')::uuid, auth.uid())
    WHEN realtime.topic() LIKE 'order-%' THEN
      public.is_order_participant(NULLIF(substring(realtime.topic(), 'order-(.*)$'), '')::uuid, auth.uid())
    ELSE false
  END
);

-- Fix food-images ownership policies: use storage object name, not restaurant name
DROP POLICY IF EXISTS "Restaurant owners can delete their food images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant owners can update their food images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant owners can upload to their food images folder" ON storage.objects;

CREATE POLICY "Restaurant owners can delete their food images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'food-images'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.owner_user_id = auth.uid()
        AND r.id::text = (storage.foldername(storage.objects.name))[1]
    )
  )
);

CREATE POLICY "Restaurant owners can update their food images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'food-images'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.owner_user_id = auth.uid()
        AND r.id::text = (storage.foldername(storage.objects.name))[1]
    )
  )
)
WITH CHECK (
  bucket_id = 'food-images'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.owner_user_id = auth.uid()
        AND r.id::text = (storage.foldername(storage.objects.name))[1]
    )
  )
);

CREATE POLICY "Restaurant owners can upload to their food images folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'food-images'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.owner_user_id = auth.uid()
        AND r.id::text = (storage.foldername(storage.objects.name))[1]
    )
  )
);

-- Add explicit UPDATE policy for chat-attachments scoped to sender + order participant
CREATE POLICY "Senders update own chat attachments"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(storage.objects.name))[2] = (auth.uid())::text
  AND public.is_order_participant(((storage.foldername(storage.objects.name))[1])::uuid, auth.uid())
)
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(storage.objects.name))[2] = (auth.uid())::text
  AND public.is_order_participant(((storage.foldername(storage.objects.name))[1])::uuid, auth.uid())
);
