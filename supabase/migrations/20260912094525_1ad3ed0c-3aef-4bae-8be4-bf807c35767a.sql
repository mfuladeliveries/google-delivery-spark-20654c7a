CREATE TABLE public.yoco_webhook_failures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage TEXT NOT NULL,
  event_id TEXT,
  event_type TEXT,
  order_id UUID,
  order_number BIGINT,
  error_message TEXT,
  payload JSONB,
  source_ip TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX yoco_webhook_failures_created_idx ON public.yoco_webhook_failures (created_at DESC);
CREATE INDEX yoco_webhook_failures_unresolved_idx ON public.yoco_webhook_failures (resolved) WHERE NOT resolved;

GRANT SELECT, UPDATE (resolved, resolved_at, resolved_by, resolution_note) ON public.yoco_webhook_failures TO authenticated;
GRANT ALL ON public.yoco_webhook_failures TO service_role;

ALTER TABLE public.yoco_webhook_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook failures"
ON public.yoco_webhook_failures FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can resolve webhook failures"
ON public.yoco_webhook_failures FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.yoco_webhook_failures;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Security fix: pin restaurant ownership and guard protected columns.
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'restaurants' AND cmd = 'UPDATE'
      AND (with_check IS NULL OR with_check = '')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.restaurants', pol.policyname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurants'
      AND policyname = 'Restaurant owners can update their restaurant'
  ) THEN
    CREATE POLICY "Restaurant owners can update their restaurant"
    ON public.restaurants FOR UPDATE TO authenticated
    USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_restaurant_owner_update_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Trusted server-side paths (service role / security definer internals) may update anything.
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  -- Admins may update anything.
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'You are not allowed to change restaurant ownership';
  END IF;
  IF NEW.rating IS DISTINCT FROM OLD.rating
     OR NEW.total_reviews IS DISTINCT FROM OLD.total_reviews THEN
    RAISE EXCEPTION 'You are not allowed to change rating or review counts';
  END IF;
  IF NEW.approval_mode IS DISTINCT FROM OLD.approval_mode
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.area_id IS DISTINCT FROM OLD.area_id THEN
    RAISE EXCEPTION 'You are not allowed to change these fields';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_restaurant_owner_update_columns ON public.restaurants;
CREATE TRIGGER enforce_restaurant_owner_update_columns
BEFORE UPDATE ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.enforce_restaurant_owner_update_columns();