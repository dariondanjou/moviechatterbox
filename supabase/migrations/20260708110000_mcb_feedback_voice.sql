-- Voice feedback (founder request 2026-07-08): the feedback sheet gains an
-- optional mic. Audio lands in a private bucket, Deepgram transcribes it
-- (FR-2.4 vendor), then the transcript flows through the same AI triage.
-- A 15-minute sweep retries transcription/classification for rows submitted
-- before the DEEPGRAM/ANTHROPIC secrets exist or after transient failures —
-- nothing is ever lost or needs manual re-processing (§1.2).

alter table public.mcb_feedback
  alter column body drop not null;

alter table public.mcb_feedback
  add column if not exists audio_path text,
  add column if not exists transcript text,
  add column if not exists transcript_status text
    check (transcript_status in ('pending', 'done', 'failed'));

-- body was NOT NULL 1..4000; now optional when a voice note is attached
alter table public.mcb_feedback
  drop constraint if exists mcb_feedback_body_check;
alter table public.mcb_feedback
  add constraint mcb_feedback_body_check
  check (body is null or char_length(body) between 1 and 4000);
alter table public.mcb_feedback
  drop constraint if exists mcb_feedback_content_check;
alter table public.mcb_feedback
  add constraint mcb_feedback_content_check
  check (body is not null or audio_path is not null);

-- voice notes are private user data — no public access; service role only
insert into storage.buckets (id, name, public)
values ('mcb-feedback-audio', 'mcb-feedback-audio', false)
on conflict (id) do nothing;

-- sweep picks up unfinished rows
create index if not exists mcb_feedback_unprocessed_idx
  on public.mcb_feedback (created_at)
  where transcript_status = 'pending' or category is null;

-- 15-minute self-healing sweep (same INGEST_KEY pattern as mcb-ingest /
-- mcb-replays-finalize; function is deployed with --no-verify-jwt)
do $$ begin
  if exists (select 1 from cron.job where jobname = 'mcb-feedback-sweep') then
    perform cron.unschedule('mcb-feedback-sweep');
  end if;
end $$;

select cron.schedule(
  'mcb-feedback-sweep',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://foilkhyhzpssobwztzcw.supabase.co/functions/v1/mcb-feedback',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ingest-key', (select decrypted_secret from vault.decrypted_secrets where name = 'mcb_ingest_key')
    ),
    body := '{"action":"sweep"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
