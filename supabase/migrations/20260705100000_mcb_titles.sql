-- Canonical title entities mapped to TMDB IDs (FS-13.3, FR-2.2.1).
-- Data provenance: TMDB only. Written by the ingest script (direct DB
-- connection); the app reads via anon key + RLS.
create table if not exists public.mcb_titles (
  id uuid primary key default gen_random_uuid(),
  tmdb_id bigint not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null,
  year int,
  overview text,
  poster_path text,
  backdrop_path text,
  genres text[] not null default '{}',
  popularity real not null default 0,
  vote_average real,
  runtime_minutes int,
  updated_at timestamptz not null default now(),
  unique (media_type, tmdb_id)
);

create index if not exists mcb_titles_popularity_idx
  on public.mcb_titles (popularity desc);
create index if not exists mcb_titles_title_idx
  on public.mcb_titles using gin (to_tsvector('simple', title));

alter table public.mcb_titles enable row level security;

drop policy if exists mcb_titles_select on public.mcb_titles;
create policy mcb_titles_select on public.mcb_titles
  for select using (true);
-- no insert/update policies: writes happen via the ingest pipeline only
