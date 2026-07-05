-- Letterboxd layer: half-star ratings + lists (FR-2.3.x, §9.2 absorb).
-- Watchlist is a per-user system list (§8: "becomes a default system list").

-- ── Ratings: 0.5–5.0 in half-star steps ─────────────────────────────────────
create table if not exists public.mcb_ratings (
  user_id uuid not null references public.mcb_profiles(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  rating numeric(2,1) not null
    check (rating >= 0.5 and rating <= 5 and rating * 2 = floor(rating * 2)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_id)
);

create index if not exists mcb_ratings_entity_idx
  on public.mcb_ratings (entity_type, entity_id);

alter table public.mcb_ratings enable row level security;

drop policy if exists mcb_ratings_select on public.mcb_ratings;
create policy mcb_ratings_select on public.mcb_ratings
  for select using (true);
drop policy if exists mcb_ratings_write_own on public.mcb_ratings;
create policy mcb_ratings_write_own on public.mcb_ratings
  for insert with check (auth.uid() = user_id);
drop policy if exists mcb_ratings_update_own on public.mcb_ratings;
create policy mcb_ratings_update_own on public.mcb_ratings
  for update using (auth.uid() = user_id);
drop policy if exists mcb_ratings_delete_own on public.mcb_ratings;
create policy mcb_ratings_delete_own on public.mcb_ratings
  for delete using (auth.uid() = user_id);

-- ── Lists ────────────────────────────────────────────────────────────────────
create table if not exists public.mcb_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.mcb_profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text,
  is_system boolean not null default false,
  is_ranked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- exactly one system list (the Watchlist) per user
create unique index if not exists mcb_lists_one_system_per_user
  on public.mcb_lists (owner_id) where is_system;

alter table public.mcb_lists enable row level security;

drop policy if exists mcb_lists_select on public.mcb_lists;
create policy mcb_lists_select on public.mcb_lists
  for select using (true);
drop policy if exists mcb_lists_insert_own on public.mcb_lists;
create policy mcb_lists_insert_own on public.mcb_lists
  for insert with check (auth.uid() = owner_id);
drop policy if exists mcb_lists_update_own on public.mcb_lists;
create policy mcb_lists_update_own on public.mcb_lists
  for update using (auth.uid() = owner_id);
drop policy if exists mcb_lists_delete_own on public.mcb_lists;
create policy mcb_lists_delete_own on public.mcb_lists
  for delete using (auth.uid() = owner_id);

-- ── List items ───────────────────────────────────────────────────────────────
create table if not exists public.mcb_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.mcb_lists(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  position int not null default 0,
  note text,
  watched boolean not null default false, -- watchlist watched/unwatched toggle
  created_at timestamptz not null default now(),
  unique (list_id, entity_type, entity_id)
);

create index if not exists mcb_list_items_list_idx
  on public.mcb_list_items (list_id, position);

alter table public.mcb_list_items enable row level security;

drop policy if exists mcb_list_items_select on public.mcb_list_items;
create policy mcb_list_items_select on public.mcb_list_items
  for select using (true);
drop policy if exists mcb_list_items_write_owner on public.mcb_list_items;
create policy mcb_list_items_write_owner on public.mcb_list_items
  for insert with check (
    exists (select 1 from public.mcb_lists l where l.id = list_id and l.owner_id = auth.uid())
  );
drop policy if exists mcb_list_items_update_owner on public.mcb_list_items;
create policy mcb_list_items_update_owner on public.mcb_list_items
  for update using (
    exists (select 1 from public.mcb_lists l where l.id = list_id and l.owner_id = auth.uid())
  );
drop policy if exists mcb_list_items_delete_owner on public.mcb_list_items;
create policy mcb_list_items_delete_owner on public.mcb_list_items
  for delete using (
    exists (select 1 from public.mcb_lists l where l.id = list_id and l.owner_id = auth.uid())
  );
