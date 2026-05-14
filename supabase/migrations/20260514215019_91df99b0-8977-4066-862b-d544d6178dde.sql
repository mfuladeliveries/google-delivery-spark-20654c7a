
-- 1) Scope realtime.messages SELECT to order participants for order-* topics
DROP POLICY IF EXISTS "Authenticated users can receive realtime messages" ON realtime.messages;

CREATE POLICY "Order participants receive realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    -- Restrict order channel topics to participants of that order
    WHEN realtime.topic() LIKE 'order-chat-%' THEN
      public.is_order_participant(
        NULLIF(substring(realtime.topic() FROM 'order-chat-(.*)$'), '')::uuid,
        auth.uid()
      )
    WHEN realtime.topic() LIKE 'order-%' THEN
      public.is_order_participant(
        NULLIF(substring(realtime.topic() FROM 'order-(.*)$'), '')::uuid,
        auth.uid()
      )
    -- Other topics (postgres_changes broadcasts, presence, etc.) remain open to authenticated users;
    -- row-level access for table changes is still enforced by per-table RLS.
    ELSE true
  END
);

-- 2) Require order-participant check on chat attachment deletes
DROP POLICY IF EXISTS "Senders delete own chat attachments" ON storage.objects;

CREATE POLICY "Senders delete own chat attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND public.is_order_participant(
    ((storage.foldername(name))[1])::uuid,
    auth.uid()
  )
);
