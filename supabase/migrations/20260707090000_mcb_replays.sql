-- Replays (FR-2.1.4): recorded Chatterboxes become replayable content.
-- LiveKit Cloud egress hosts the file for 30 days; the finalize function
-- copies it into Supabase Storage (mcb-replays bucket) for permanence.
-- Fully automated — no operator steps (Solo-Operator Principle, §1.2).

create table if not exists public.mcb_recordings (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references public.mcb_chatterboxes(id) on delete cascade,
  egress_id text not null unique,
  status text not null default 'recording'
    check (status in ('recording', 'processing', 'ready', 'failed')),
  storage_path text,
  duration_seconds integer,
  size_bytes bigint,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists mcb_recordings_box_idx
  on public.mcb_recordings (box_id, started_at);
-- The finalizer sweeps only unfinished rows
create index if not exists mcb_recordings_pending_idx
  on public.mcb_recordings (status)
  where status in ('recording', 'processing');

-- Replays are public content (SEO surface, FR-6.2); writes are
-- service-role only (edge functions), so no insert/update policies.
alter table public.mcb_recordings enable row level security;
drop policy if exists mcb_recordings_select on public.mcb_recordings;
create policy mcb_recordings_select on public.mcb_recordings
  for select using (true);

-- Public bucket for replay audio
insert into storage.buckets (id, name, public)
values ('mcb-replays', 'mcb-replays', true)
on conflict (id) do nothing;

-- Finalize sweep every 5 minutes: completes egresses, copies files to
-- storage, marks rows ready/failed. Reuses the mcb_ingest_key secret
-- (project-wide edge secret INGEST_KEY) from the nightly ingest setup.
do $$ begin
  if exists (select 1 from cron.job where jobname = 'mcb-replays-finalize') then
    perform cron.unschedule('mcb-replays-finalize');
  end if;
end $$;

select cron.schedule(
  'mcb-replays-finalize',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://foilkhyhzpssobwztzcw.supabase.co/functions/v1/mcb-replays-finalize',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ingest-key', (select decrypted_secret from vault.decrypted_secrets where name = 'mcb_ingest_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
