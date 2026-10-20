-- Explicit least-privilege ACLs for every existing public base table.
-- Remove inherited PUBLIC access and obsolete broad client grants, not RLS.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v') LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t.relname);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.relname);
  END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings, public.customer_addresses, public.delivery_areas, public.driver_access_requests, public.driver_profiles, public.driver_rejected_orders, public.driver_service_areas, public.menu_items, public.order_messages, public.order_ratings, public.orders, public.promo_codes, public.push_subscriptions, public.restaurant_locations, public.restaurants, public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.customer_favourites TO authenticated;
GRANT SELECT, INSERT ON public.order_policy_acceptances, public.order_rejections TO authenticated;
GRANT SELECT ON public.credit_transactions, public.customer_credits, public.delivery_pin_overrides, public.driver_earnings, public.fee_audit_log, public.invalid_order_attempts, public.order_dispatch_log, public.order_notification_log, public.payment_transactions, public.payment_webhook_events, public.promo_redemptions, public.push_config, public.rate_limits, public.referral_codes, public.referrals, public.whatsapp_notification_outbox, public.withdrawal_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.peak_surcharge_windows TO authenticated;
GRANT SELECT ON public.yoco_webhook_failures TO authenticated;
GRANT UPDATE (resolved, resolved_at, resolved_by, resolution_note) ON public.yoco_webhook_failures TO authenticated;
GRANT SELECT ON public.app_settings, public.delivery_areas, public.menu_items, public.peak_surcharge_windows, public.push_config, public.restaurant_locations TO anon;
-- Preserve the deliberate restaurant-owner UUID exclusion from public catalog reads.
DO $$ DECLARE cols text; BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO cols FROM pg_attribute WHERE attrelid='public.restaurants'::regclass AND attnum>0 AND NOT attisdropped AND attname<>'owner_user_id';
  EXECUTE 'GRANT SELECT (' || cols || ') ON public.restaurants TO anon';
END $$;
-- The four email infrastructure tables intentionally have no client grants.
-- Serial sequences are available to trusted server creation paths, not clients.
DO $$ DECLARE s record; BEGIN
  FOR s IN SELECT sequencename FROM pg_sequences WHERE schemaname='public' LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM PUBLIC, anon, authenticated',s.sequencename);
    EXECUTE format('GRANT ALL ON SEQUENCE public.%I TO service_role',s.sequencename);
  END LOOP;
END $$;
-- Driver self-repair and self-edit require the admin-assigned driver role.
ALTER POLICY "Drivers can insert own profile" ON public.driver_profiles WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'driver'));
ALTER POLICY "Drivers can update own profile" ON public.driver_profiles USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'driver')) WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'driver'));
-- Enforce existing protected-column rules in the caller's role, not the function owner's.
ALTER FUNCTION public.enforce_driver_profile_update_columns() SECURITY INVOKER;
ALTER FUNCTION public.enforce_restaurant_owner_update_columns() SECURITY INVOKER;
-- A recipient may only mark a received message read; content and identities are immutable.
CREATE OR REPLACE FUNCTION public.enforce_order_message_read_only_update()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  IF current_user NOT IN ('anon','authenticated') OR public.has_role(auth.uid(),'admin') THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR OLD.sender_id=auth.uid() OR NOT public.is_order_participant(OLD.order_id,auth.uid()) THEN RAISE EXCEPTION 'Only recipients can mark messages read' USING ERRCODE='42501'; END IF;
  IF (to_jsonb(NEW)-'read_at') IS DISTINCT FROM (to_jsonb(OLD)-'read_at') THEN RAISE EXCEPTION 'Only read_at may be updated' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER order_messages_read_at_only_updates BEFORE UPDATE ON public.order_messages FOR EACH ROW EXECUTE FUNCTION public.enforce_order_message_read_only_update();
-- Preserve the driver view's columns while enforcing authorization in a narrow RPC.
CREATE OR REPLACE FUNCTION public.read_authorized_driver_orders()
RETURNS SETOF public.driver_orders LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT o.id,o.order_number,o.restaurant,o.restaurant_id,
    CASE WHEN o.driver_id=auth.uid() OR public.has_role(auth.uid(),'admin') THEN o.items ELSE COALESCE((SELECT jsonb_agg(jsonb_build_object('name',i->>'name','quantity',i->'quantity')) FROM jsonb_array_elements(o.items) i),'[]'::jsonb) END,
    CASE WHEN o.driver_id=auth.uid() OR public.has_role(auth.uid(),'admin') THEN o.special_notes ELSE NULL::text END,
    o.tip,o.delivery_fee,
    CASE WHEN o.driver_id=auth.uid() OR public.has_role(auth.uid(),'admin') THEN o.customer_name ELSE NULL::text END,
    CASE WHEN o.driver_id=auth.uid() OR public.has_role(auth.uid(),'admin') THEN o.customer_contact ELSE NULL::text END,
    CASE WHEN o.driver_id=auth.uid() OR public.has_role(auth.uid(),'admin') THEN o.customer_address ELSE COALESCE(da.name,'Delivery area') END,
    CASE WHEN o.driver_id=auth.uid() OR public.has_role(auth.uid(),'admin') THEN o.customer_lat ELSE NULL::double precision END,
    CASE WHEN o.driver_id=auth.uid() OR public.has_role(auth.uid(),'admin') THEN o.customer_lng ELSE NULL::double precision END,
    o.status,o.created_at,o.driver_id,
    CASE WHEN o.driver_id=auth.uid() OR public.has_role(auth.uid(),'admin') THEN o.driver_lat ELSE NULL::double precision END,
    CASE WHEN o.driver_id=auth.uid() OR public.has_role(auth.uid(),'admin') THEN o.driver_lng ELSE NULL::double precision END,
    o.driver_location_updated_at,o.accepted_at,o.picking_up_at,o.arrived_at,o.picked_up_at,o.delivered_at,o.cancelled_at,
    CASE WHEN o.driver_id=auth.uid() OR public.has_role(auth.uid(),'admin') THEN o.cancel_reason ELSE NULL::text END,
    o.offered_to_driver_id,o.offer_expires_at,o.dispatch_phase,o.dispatch_round,o.dispatch_started_at,
    CASE WHEN o.driver_id=auth.uid() OR public.has_role(auth.uid(),'admin') THEN o.address_tag ELSE da.name END,o.pin_attempts
  FROM public.orders o
  LEFT JOIN public.restaurant_locations rl ON rl.id=o.restaurant_location_id
  LEFT JOIN public.restaurants r ON r.id=o.restaurant_id
  LEFT JOIN public.delivery_areas da ON da.id=COALESCE(rl.area_id,r.area_id)
  WHERE public.has_role(auth.uid(),'admin') OR (
    public.has_role(auth.uid(),'driver') AND (
      o.driver_id=auth.uid() OR (
        EXISTS(SELECT 1 FROM public.driver_profiles dp WHERE dp.user_id=auth.uid() AND dp.is_online AND NOT dp.is_suspended)
        AND (o.offered_to_driver_id=auth.uid() OR (o.driver_id IS NULL AND o.status='ready' AND o.dispatch_phase='broadcast'))
      )
    )
  );
$$;
REVOKE ALL ON FUNCTION public.read_authorized_driver_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.read_authorized_driver_orders() TO authenticated, service_role;
CREATE OR REPLACE VIEW public.driver_orders WITH (security_invoker=true, security_barrier=true) AS SELECT * FROM public.read_authorized_driver_orders();
GRANT SELECT ON public.driver_orders, public.driver_job_board TO authenticated;
-- Service-only internal functions must not remain executable through PUBLIC inheritance.
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.prorettype='trigger'::regtype OR p.proname IN ('check_rate_limit','log_invalid_order_attempt','dispatch_assign_next','dispatch_tick','auto_cancel_stale_orders','auto_cancel_stale_awaiting_orders','expire_stale_pending_payments','confirm_online_payment','mark_online_payment_failed','mark_online_payment_refunded','enqueue_email','read_email_batch','delete_email','move_to_dlq','email_queue_dispatch')) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
  END LOOP;
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.proname LIKE 'admin\_%' ESCAPE '\' OR p.proname LIKE 'driver\_%' ESCAPE '\' OR p.proname LIKE 'customer\_%' ESCAPE '\' OR p.proname IN ('claim_order','create_verified_order','apply_checkout_code','get_customer_balance','get_driver_balance','get_or_create_referral_code','request_withdrawal','spend_customer_credits','regenerate_delivery_pin','get_active_delivery_pin','verify_and_complete_delivery','restaurant_decide_availability','is_order_participant','order_sender_role_valid')) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon',f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role',f.signature);
  END LOOP;
END $$;
-- Notify PostgREST to refresh privileges and the secured view definition.
NOTIFY pgrst, 'reload schema';