DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'restaurants'
    AND column_name NOT IN ('owner_user_id', 'contact_number');
  EXECUTE format('GRANT SELECT (%s) ON public.restaurants TO anon', cols);
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO service_role;