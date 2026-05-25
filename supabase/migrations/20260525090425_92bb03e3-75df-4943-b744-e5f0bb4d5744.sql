-- 1. One-time cleanup: cancel pending_payment orders older than 30 min
SELECT public.expire_stale_pending_payments();
SELECT public.auto_cancel_stale_awaiting_orders();

-- 2. Schedule recurring cleanup every 5 minutes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-pending-payments') THEN
    PERFORM cron.unschedule('expire-pending-payments');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-cancel-stale-awaiting') THEN
    PERFORM cron.unschedule('auto-cancel-stale-awaiting');
  END IF;
END $$;

SELECT cron.schedule(
  'expire-pending-payments',
  '*/5 * * * *',
  $$SELECT public.expire_stale_pending_payments();$$
);

SELECT cron.schedule(
  'auto-cancel-stale-awaiting',
  '*/5 * * * *',
  $$SELECT public.auto_cancel_stale_awaiting_orders();$$
);