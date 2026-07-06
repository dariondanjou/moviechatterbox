-- Person entities + credits (§9.1: person pages with filmography are
-- required for runner entity matching, FR-2.4.3). TMDB-sourced, read-only
-- via RLS; written by the ingest pipeline.
create table if not exists public.mcb_persons (
  id uuid primary key default gen_random_uuid(),
  tmdb_id bigint not null unique,
  name text not null,
  profile_path text,
  known_for text,
  popularity real not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists mcb_persons_name_idx
  on public.mcb_persons using gin (to_tsvector('simple', name));

create table if not exists public.mcb_credits (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.mcb_persons(id) on delete cascade,
  title_id uuid not null references public.mcb_titles(id) on delete cascade,
  kind text not null check (kind in ('cast', 'crew')),
  role text, -- character name (cast) or job (crew)
  billing int not null default 999,
  unique (person_id, title_id, kind)
);

create index if not exists mcb_credits_title_idx
  on public.mcb_credits (title_id, kind, billing);
create index if not exists mcb_credits_person_idx
  on public.mcb_credits (person_id);

alter table public.mcb_persons enable row level security;
alter table public.mcb_credits enable row level security;

drop policy if exists mcb_persons_select on public.mcb_persons;
create policy mcb_persons_select on public.mcb_persons
  for select using (true);
drop policy if exists mcb_credits_select on public.mcb_credits;
create policy mcb_credits_select on public.mcb_credits
  for select using (true);
