-- Add attachment columns to order_messages
ALTER TABLE public.order_messages
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_type text;

-- Allow attachment-only messages (message can be empty when there's an attachment)
ALTER TABLE public.order_messages
  ALTER COLUMN message DROP NOT NULL;

-- Validate: either text or attachment must be present, and attachment_type is constrained
ALTER TABLE public.order_messages
  DROP CONSTRAINT IF EXISTS order_messages_content_check;
ALTER TABLE public.order_messages
  ADD CONSTRAINT order_messages_content_check
  CHECK (
    (COALESCE(message, '') <> '' OR attachment_url IS NOT NULL)
    AND (attachment_type IS NULL OR attachment_type IN ('image', 'audio'))
  );

-- Create the chat-attachments storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: only order participants (or admins) can read/write
-- Files are stored under path: <order_id>/<sender_id>/<timestamp>.<ext>

DROP POLICY IF EXISTS "Order participants read chat attachments" ON storage.objects;
CREATE POLICY "Order participants read chat attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (
    public.is_order_participant(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

DROP POLICY IF EXISTS "Order participants upload chat attachments" ON storage.objects;
CREATE POLICY "Order participants upload chat attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND public.is_order_participant(
    ((storage.foldername(name))[1])::uuid,
    auth.uid()
  )
);

DROP POLICY IF EXISTS "Senders delete own chat attachments" ON storage.objects;
CREATE POLICY "Senders delete own chat attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);
