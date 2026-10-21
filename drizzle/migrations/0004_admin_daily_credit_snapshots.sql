CREATE TABLE public.daily_credit_usage (
  recorded_date date PRIMARY KEY,
  backend_credits numeric(20,9) NOT NULL DEFAULT 0 CHECK (backend_credits >= 0),
  function_credits numeric(20,9) NOT NULL DEFAULT 0 CHECK (function_credits >= 0),
  storage_credits numeric(20,9) NOT NULL DEFAULT 0 CHECK (storage_credits >= 0),
  traffic_credits numeric(20,9) NOT NULL DEFAULT 0 CHECK (traffic_credits >= 0),
  is_partial_day boolean NOT NULL DEFAULT false,
  result_partial boolean NOT NULL DEFAULT false,
  recorded_to_exclusive timestamptz NOT NULL,
  retrieved_at timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'Lovable project recorded usage',
  CHECK (recorded_to_exclusive > recorded_date::timestamp AT TIME ZONE 'UTC')
);
REVOKE ALL ON public.daily_credit_usage FROM anon, authenticated;
GRANT SELECT ON public.daily_credit_usage TO authenticated;
GRANT ALL ON public.daily_credit_usage TO service_role;
ALTER TABLE public.daily_credit_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins read daily credit snapshots" ON public.daily_credit_usage FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
COMMENT ON TABLE public.daily_credit_usage IS 'Admin-only UTC daily project running requested-credit snapshots. Not cash paid or recorded deductions; refreshed by authorized chat lookup, never a public client bundle or scheduled billing poll.';