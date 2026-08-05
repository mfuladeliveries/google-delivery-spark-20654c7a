SELECT cron.alter_job(
  2,
  command := $cmd$
  SELECT net.http_post(
    url := 'https://kdplufybixfqsqhyixxw.supabase.co/functions/v1/dispatch-tick',
    headers := '{"Content-Type":"application/json","x-dispatch-secret":"e6c1d8e1054ef3745faa47e95d27a53a4d3bd389dbb380aeceea66631c61b7e3"}'::jsonb,
    body := '{}'::jsonb
  );
  SELECT pg_sleep(15);
  SELECT net.http_post(
    url := 'https://kdplufybixfqsqhyixxw.supabase.co/functions/v1/dispatch-tick',
    headers := '{"Content-Type":"application/json","x-dispatch-secret":"e6c1d8e1054ef3745faa47e95d27a53a4d3bd389dbb380aeceea66631c61b7e3"}'::jsonb,
    body := '{}'::jsonb
  );
  SELECT pg_sleep(15);
  SELECT net.http_post(
    url := 'https://kdplufybixfqsqhyixxw.supabase.co/functions/v1/dispatch-tick',
    headers := '{"Content-Type":"application/json","x-dispatch-secret":"e6c1d8e1054ef3745faa47e95d27a53a4d3bd389dbb380aeceea66631c61b7e3"}'::jsonb,
    body := '{}'::jsonb
  );
  SELECT pg_sleep(15);
  SELECT net.http_post(
    url := 'https://kdplufybixfqsqhyixxw.supabase.co/functions/v1/dispatch-tick',
    headers := '{"Content-Type":"application/json","x-dispatch-secret":"e6c1d8e1054ef3745faa47e95d27a53a4d3bd389dbb380aeceea66631c61b7e3"}'::jsonb,
    body := '{}'::jsonb
  );
  $cmd$
);