-- User feedback (founder request 2026-07-08): persistent feedback button in
-- the tab bar. Rows are written by the mcb-feedback edge function, which
-- also runs AI categorization (Claude) so triage needs no manual sorting
-- (Solo-Operator Principle, §1.2). Tracks community needs over time.

create table if not exists public.mcb_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  -- context captured at submit time: where, on what, which build
  route text,
  platform text,
  os_version text,
  app_version text,
  -- AI triage (null until classified; retried while null)
  category text check (category in (
    'bug', 'feature_request', 'ux', 'performance', 'audio',
    'content', 'moderation', 'account', 'praise', 'other'
  )),
  sentiment text check (sentiment in ('positive', 'neutral', 'negative')),
  ai_summary text,
  -- founder triage over time
  status text not null default 'new'
    check (status in ('new', 'triaged', 'planned', 'done', 'dismissed')),
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mcb_feedback_status_idx
  on public.mcb_feedback (status, created_at desc);
create index if not exists mcb_feedback_category_idx
  on public.mcb_feedback (category, created_at desc);

-- Users see their own submissions; writes go through the edge function
-- (service role), so no client insert/update policies.
alter table public.mcb_feedback enable row level security;

drop policy if exists mcb_feedback_select_own on public.mcb_feedback;
create policy mcb_feedback_select_own on public.mcb_feedback
  for select using (auth.uid() = user_id);
