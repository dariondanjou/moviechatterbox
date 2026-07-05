-- Persistent async text thread on every content entity (FR-2.2.2).
-- Keyed on (entity_type, entity_id) so persons/episodes/lists join the same
-- spine later (FS-13.3).
create table if not exists public.mcb_thread_posts (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  user_id uuid not null references public.mcb_profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists mcb_thread_posts_entity_idx
  on public.mcb_thread_posts (entity_type, entity_id, created_at desc);

alter table public.mcb_thread_posts enable row level security;

drop policy if exists mcb_thread_posts_select on public.mcb_thread_posts;
create policy mcb_thread_posts_select on public.mcb_thread_posts
  for select using (true);
drop policy if exists mcb_thread_posts_insert on public.mcb_thread_posts;
create policy mcb_thread_posts_insert on public.mcb_thread_posts
  for insert with check (auth.uid() = user_id);
drop policy if exists mcb_thread_posts_delete_own on public.mcb_thread_posts;
create policy mcb_thread_posts_delete_own on public.mcb_thread_posts
  for delete using (auth.uid() = user_id);
