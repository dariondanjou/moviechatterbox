-- Interest-profile signal events (FR-11.1). Append-only behavioral log,
-- emitted from day one so the data asset accumulates before the
-- recommender (FR-11.3/11.4) exists. Collection is disclosed per FR-12.1.
--
-- High-volume append table: bigint identity, no FK on box_id (events
-- outlive everything), event types documented in mcb-app/src/lib/signals.ts.

create table if not exists public.mcb_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  -- canonical content spine (FS-13.3)
  entity_type text,
  entity_id text,
  box_id uuid,
  -- numeric payload: dwell/listen seconds, rating value, …
  value double precision,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mcb_events_user_idx
  on public.mcb_events (user_id, created_at desc);
create index if not exists mcb_events_type_idx
  on public.mcb_events (event_type, created_at desc);

-- Users write their own events and can read them back (FR-12.3 access
-- and export rights). The profiling pipeline reads with the service role.
alter table public.mcb_events enable row level security;

drop policy if exists mcb_events_insert_own on public.mcb_events;
create policy mcb_events_insert_own on public.mcb_events
  for insert with check (auth.uid() = user_id);
drop policy if exists mcb_events_select_own on public.mcb_events;
create policy mcb_events_select_own on public.mcb_events
  for select using (auth.uid() = user_id);
