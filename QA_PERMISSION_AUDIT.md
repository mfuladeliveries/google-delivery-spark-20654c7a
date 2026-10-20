# Data API permission audit — 20 October 2026

## Verified live database

Inspected 43 public base tables; all 43 have RLS enabled. After the applied changes, anonymous users have zero table-level INSERT/UPDATE/DELETE grants, and email infrastructure tables have zero anonymous/authenticated table grants.

Tables inspected: app_settings, credit_transactions, customer_addresses, customer_credits, customer_favourites, delivery_areas, delivery_pin_overrides, driver_access_requests, driver_earnings, driver_profiles, driver_rejected_orders, driver_service_areas, email_send_log, email_send_state, email_unsubscribe_tokens, fee_audit_log, invalid_order_attempts, menu_items, order_dispatch_log, order_messages, order_notification_log, order_policy_acceptances, order_ratings, order_rejections, orders, payment_transactions, payment_webhook_events, peak_surcharge_windows, profiles, promo_codes, promo_redemptions, push_config, push_subscriptions, rate_limits, referral_codes, referrals, restaurant_locations, restaurants, suppressed_emails, user_roles, whatsapp_notification_outbox, withdrawal_requests, yoco_webhook_failures.

## Applied changes

- `drizzle/migrations/0002_data_api_least_privilege_and_driver_privacy.sql`: explicit client/server ACLs; private email infrastructure; service-only internal/payment/dispatch functions; driver self-insert/update requires the assigned driver role; existing driver/restaurant column guards execute in the caller context; recipient chat updates may change only read_at; driver feed requires admin/driver role and masks unassigned customer identity, coordinates, notes, and item options. Existing role and row policies remain in place.
- `drizzle/migrations/0003_refine_client_write_permissions.sql`: removes direct order INSERT, driver-profile DELETE and rejected-order UPDATE/DELETE grants; public surcharge reads show active windows only.
- Anonymous restaurant reads omit owner_user_id. Public settings remain restricted by the existing about_page policy; push_config is limited to vapid_public_key. Referral codes already have own-user/admin RLS in the live database.
- `src/hooks/useAuth.tsx`: fixes reproduced authenticated-page loading deadlock by deferring database requests outside the auth callback lock.
- Added `src/lib/__tests__/authSessionLoading.test.tsx` and read-only `e2e/data-api-permissions.spec.ts`.
- No orders submitted, payments processed, payment settings changed, or restaurant/menu prices modified.

## Historical creation migrations updated with explicit grants

Under `supabase/migrations/` (unique timestamp prefixes):

20260217233532, 20260218044134, 20260306184956, 20260309120627, 20260418001423, 20260420161039, 20260420162142, 20260420170345, 20260420205150, 20260421141221, 20260423205338, 20260423235957, 20260426134410, 20260428190825, 20260430013600, 20260430091245, 20260430200604, 20260501004800, 20260912143000.

Historical edits do not update already-applied databases; the two new migrations above were actually applied. A historical blanket-grant migration remains in the replay stream, so the final ACL migrations must follow that stream when preparing a clean baseline.

## Tests actually performed

- 12 Vitest files, 88 tests passed, including the new auth-lock regression. React act-environment warnings occurred in that test, but it passed.
- Three saved read-only Data API tests passed: anonymous private-data denial; confirmed customer's own profile readable and other users' profile/order/address rows denied; customer driver feed empty.
- Real API reads: public restaurant/menu/area reads succeed; anonymous orders/profiles/addresses/driver feed/email/payment reads denied; customer email access denied.
- Browser: confirmed customer profile, order history and home load; address autocomplete returns 32 Urha Street, resolves it into Mfuleni and enables Save without saving; Debonnairs menu options and cart exercised. Cart displayed R95 subtotal + R4.75 service fee + existing R65 delivery = R164.75. No checkout submission.
- Browser page-error capture reported no runtime errors in the completed customer flow.
- Harness compilation/typecheck: latest observed entry `build OK` at 17:02:08 UTC. No manual production build was run because this environment delegates builds to its harness.

## Not verified / remaining blockers

- Driver/admin/restaurant authenticated UI and write-policy tests: no approved sessions for those roles were available; the minted requester account is customer-only. No privileged account was selected or impersonated.
- Driver view masking was exercised through customer denial, not a real assigned-driver delivery. The view's function uses its existing row type; live creation/read succeeded, but clean-replay dependency behavior remains untested.
- Full hosted Data API exposure settings: no successful settings read was available. The tested public REST endpoints are reachable; this does not establish every hosted exposure setting.
- Fresh database, preview-branch reset and `supabase db reset` were not run against production. Source audit found pre-existing replay blockers: a driver-trigger EXECUTE revoke before its definition; referral policy statements before table creation; email_queue_dispatch references without a source definition; order_ratings missing a creation migration; cron-job ordering/environment assumptions. The Supabase and Drizzle migration streams are not a complete independently resettable baseline. Fresh-reset readiness is therefore NOT established.
- Security results are stale; no clean-security claim is made. The earlier order_messages_update_no_column_restriction identifier was absent from the available persisted results, so it was not falsely marked fixed there; its read_at-only trigger was applied.
- No git commit/push performed: stateful Git operations are managed by Lovable, and repository sync status is not available to this agent.
- Prior content blockers remain: branch-confirmed Steers and Burger King prices, and confirmed Mfuleni Steers coordinates.

This audit improves the live access rules and verifies public/customer reads; it is not a claim of complete production or fresh-reset certification.