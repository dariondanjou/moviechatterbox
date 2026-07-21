-- Replays are automatic unless the host opts out (founder decision 2026-07-21,
-- supersedes FR-12 host opt-in for recording; in-room disclosure unchanged).
-- Chosen on the start screen; hosts can still "stop rec" mid-room.
alter table public.mcb_chatterboxes
  add column if not exists record_on_live boolean not null default true;
