-- Nightly TMDB ingest schedule (applied 2026-07-06; recorded here for
-- reference). Calls the mcb-ingest edge function daily at 09:00 UTC.
--
-- NOTE: the real INGEST_KEY lives in Supabase Vault (name: mcb_ingest_key)
-- and as an edge-function secret — it is NOT in this file. If re-applying
-- from scratch, generate a key, run `supabase secrets set INGEST_KEY=...`,
-- and replace <INGEST_KEY> below.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$ begin
  if not exists (select 1 from vault.secrets where name = 'mcb_ingest_key') then
    perform vault.create_secret('<INGEST_KEY>', 'mcb_ingest_key');
  end if;
  if exists (select 1 from cron.job where jobname = 'mcb-nightly-ingest') then
    perform cron.unschedule('mcb-nightly-ingest');
  end if;
end $$;

select cron.schedule(
  'mcb-nightly-ingest',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://foilkhyhzpssobwztzcw.supabase.co/functions/v1/mcb-ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ingest-key', (select decrypted_secret from vault.decrypted_secrets where name = 'mcb_ingest_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);
