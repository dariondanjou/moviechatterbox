-- Moderation tooling (FR-5.1): host mute/remove + user block/report.
-- Additive only: new columns on mcb_participants, new mcb_blocks / mcb_reports.
-- Hosts are accountable moderators of their Chatterboxes (ToS); everything
-- here runs without operator intervention (Solo-Operator Principle, §1.2).

-- ── Participant removal (host kicks) ────────────────────────────────────────
alter table public.mcb_participants
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid references auth.users(id);

-- Guards, enforced before RLS-permitted updates land:
--   * only the box host may set or clear removal, and never on the host row
--   * a removed participant cannot rejoin (their upsert hits the UPDATE path)
--   * nobody may unmute someone else's mic — host moderation can only mute
create or replace function public.mcb_guard_participant_moderation()
returns trigger language plpgsql as $$
declare
  is_box_host boolean;
begin
  select exists (
    select 1 from public.mcb_chatterboxes b
    where b.id = new.box_id and b.host_id = auth.uid()
  ) into is_box_host;

  if tg_op = 'INSERT' then
    if new.removed_at is not null and not is_box_host then
      raise exception 'only the host can remove participants';
    end if;
    return new;
  end if;

  if old.removed_at is not null and not is_box_host then
    raise exception 'removed from this Chatterbox';
  end if;

  if new.removed_at is distinct from old.removed_at
     or new.removed_by is distinct from old.removed_by then
    if not is_box_host then
      raise exception 'only the host can remove participants';
    end if;
    if old.role = 'host' then
      raise exception 'the host cannot be removed';
    end if;
    if new.removed_at is not null then
      new.removed_by := auth.uid();
      new.left_at := coalesce(new.left_at, now());
      new.hand_raised := false;
      new.muted := true;
    end if;
  end if;

  if new.muted = false and old.muted = true
     and auth.uid() is distinct from new.user_id then
    raise exception 'only a speaker can unmute themself';
  end if;

  return new;
end $$;

drop trigger if exists mcb_participants_moderation_guard on public.mcb_participants;
create trigger mcb_participants_moderation_guard
  before insert or update on public.mcb_participants
  for each row execute function public.mcb_guard_participant_moderation();

-- ── Blocks (user-level, app-wide) ────────────────────────────────────────────
create table if not exists public.mcb_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.mcb_blocks enable row level security;

drop policy if exists mcb_blocks_select_own on public.mcb_blocks;
create policy mcb_blocks_select_own on public.mcb_blocks
  for select using (auth.uid() = blocker_id);
drop policy if exists mcb_blocks_insert_own on public.mcb_blocks;
create policy mcb_blocks_insert_own on public.mcb_blocks
  for insert with check (auth.uid() = blocker_id);
drop policy if exists mcb_blocks_delete_own on public.mcb_blocks;
create policy mcb_blocks_delete_own on public.mcb_blocks
  for delete using (auth.uid() = blocker_id);

-- ── Reports ──────────────────────────────────────────────────────────────────
-- Written by any signed-in user; reviewed asynchronously (AI moderation
-- pipeline lands with FR-5.2 — this table is its inbox).
create table if not exists public.mcb_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null
    check (target_type in ('user', 'chatterbox', 'message', 'thread_post', 'review')),
  target_id text not null,
  box_id uuid references public.mcb_chatterboxes(id) on delete set null,
  reason text not null
    check (reason in ('spam', 'harassment', 'hate', 'sexual', 'violence', 'other')),
  details text check (char_length(details) <= 2000),
  status text not null default 'open'
    check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists mcb_reports_open_idx
  on public.mcb_reports (status, created_at desc);

alter table public.mcb_reports enable row level security;

drop policy if exists mcb_reports_insert_own on public.mcb_reports;
create policy mcb_reports_insert_own on public.mcb_reports
  for insert with check (auth.uid() = reporter_id);
drop policy if exists mcb_reports_select_own on public.mcb_reports;
create policy mcb_reports_select_own on public.mcb_reports
  for select using (auth.uid() = reporter_id);
