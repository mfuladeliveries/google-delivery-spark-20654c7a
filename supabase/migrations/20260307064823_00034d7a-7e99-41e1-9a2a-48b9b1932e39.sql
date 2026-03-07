
-- Just ensure the admin policy exists too (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view driver documents' AND tablename = 'objects'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY "Admins can view driver documents"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'driver-documents'
        AND has_role(auth.uid(), 'admin'::app_role)
      )
    $sql$;
  END IF;
END $$;
