-- MovieChatterbox rebuild: audio core schema (FR-2.1.x)
-- Additive only: new mcb_ tables alongside the live site's tables.
-- Naming note: SQL uses "box" internally; UI copy always says Chatterbox (FR-10.x).

-- ── Profiles ────────────────────────────────────────────────────────────────
create table if not exists public.mcb_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  display_name text,
  avatar_url text,
  bio text,
  is_premium boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.mcb_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.mcb_profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists mcb_on_auth_user_created on auth.users;
create trigger mcb_on_auth_user_created
  after insert on auth.users
  for each row execute function public.mcb_handle_new_user();

-- Existing accounts can sign straight into the new app; give them profile rows.
insert into public.mcb_profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;

-- ── Chatterboxes (lifecycle: scheduled → live → ended, FR-2.1.3) ────────────
create table if not exists public.mcb_chatterboxes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 140),
  topic text,
  host_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'live' check (status in ('scheduled', 'live', 'ended')),
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  is_recorded boolean not null default false,
  -- canonical-ID spine (FS-13.3); wired up when the database layer ships
  entity_type text,
  entity_id text,
  created_at timestamptz not null default now()
);

create index if not exists mcb_chatterboxes_status_idx
  on public.mcb_chatterboxes (status, created_at desc);

-- ── Participants (stage model: host / speaker / listener, FR-2.1.2) ─────────
create table if not exists public.mcb_participants (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references public.mcb_chatterboxes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'listener' check (role in ('host', 'speaker', 'listener')),
  hand_raised boolean not null default false,
  muted boolean not null default true,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (box_id, user_id)
);

create index if not exists mcb_participants_active_idx
  on public.mcb_participants (box_id) where left_at is null;

-- Stage roles are host-controlled: RLS lets users update their own row
-- (hand raise, mute, leave), so a trigger guards the role column.
create or replace function public.mcb_guard_participant_role()
returns trigger language plpgsql as $$
declare
  is_box_host boolean;
begin
  select exists (
    select 1 from public.mcb_chatterboxes b
    where b.id = new.box_id and b.host_id = auth.uid()
  ) into is_box_host;

  if tg_op = 'INSERT' then
    if new.role <> 'listener' and not is_box_host then
      raise exception 'only the host can assign stage roles';
    end if;
  elsif new.role is distinct from old.role then
    if not is_box_host then
      raise exception 'only the host can change stage roles';
    end if;
    if old.role = 'host' or (new.role = 'host' and old.role <> 'host') then
      raise exception 'the host role cannot be reassigned';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists mcb_participants_role_guard on public.mcb_participants;
create trigger mcb_participants_role_guard
  before insert or update on public.mcb_participants
  for each row execute function public.mcb_guard_participant_role();

-- ── In-room text chat (companion + degradation channel, FR-2.1.5) ───────────
create table if not exists public.mcb_messages (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references public.mcb_chatterboxes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists mcb_messages_box_idx
  on public.mcb_messages (box_id, created_at);

-- ── Row-level security ───────────────────────────────────────────────────────
alter table public.mcb_profiles enable row level security;
alter table public.mcb_chatterboxes enable row level security;
alter table public.mcb_participants enable row level security;
alter table public.mcb_messages enable row level security;

drop policy if exists mcb_profiles_select on public.mcb_profiles;
create policy mcb_profiles_select on public.mcb_profiles
  for select using (true);
drop policy if exists mcb_profiles_insert on public.mcb_profiles;
create policy mcb_profiles_insert on public.mcb_profiles
  for insert with check (auth.uid() = id);
drop policy if exists mcb_profiles_update on public.mcb_profiles;
create policy mcb_profiles_update on public.mcb_profiles
  for update using (auth.uid() = id);

drop policy if exists mcb_boxes_select on public.mcb_chatterboxes;
create policy mcb_boxes_select on public.mcb_chatterboxes
  for select using (true);
drop policy if exists mcb_boxes_insert on public.mcb_chatterboxes;
create policy mcb_boxes_insert on public.mcb_chatterboxes
  for insert with check (auth.uid() = host_id);
drop policy if exists mcb_boxes_update_host on public.mcb_chatterboxes;
create policy mcb_boxes_update_host on public.mcb_chatterboxes
  for update using (auth.uid() = host_id);

drop policy if exists mcb_parts_select on public.mcb_participants;
create policy mcb_parts_select on public.mcb_participants
  for select using (true);
drop policy if exists mcb_parts_insert_self on public.mcb_participants;
create policy mcb_parts_insert_self on public.mcb_participants
  for insert with check (auth.uid() = user_id);
drop policy if exists mcb_parts_update_self on public.mcb_participants;
create policy mcb_parts_update_self on public.mcb_participants
  for update using (auth.uid() = user_id);
drop policy if exists mcb_parts_update_host on public.mcb_participants;
create policy mcb_parts_update_host on public.mcb_participants
  for update using (
    exists (
      select 1 from public.mcb_chatterboxes b
      where b.id = box_id and b.host_id = auth.uid()
    )
  );

drop policy if exists mcb_msgs_select on public.mcb_messages;
create policy mcb_msgs_select on public.mcb_messages
  for select using (true);
drop policy if exists mcb_msgs_insert on public.mcb_messages;
create policy mcb_msgs_insert on public.mcb_messages
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.mcb_participants p
      where p.box_id = mcb_messages.box_id
        and p.user_id = auth.uid()
        and p.left_at is null
    )
  );

-- ── Realtime ────────────────────────────────────────────────────────────────
alter table public.mcb_chatterboxes replica identity full;
alter table public.mcb_participants replica identity full;
alter table public.mcb_messages replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.mcb_chatterboxes;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.mcb_participants;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.mcb_messages;
exception when duplicate_object then null; end $$;
