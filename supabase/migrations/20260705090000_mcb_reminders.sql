-- Reminders for scheduled Chatterboxes (FR-2.1.3). Delivery (push) lands with
-- the native build; counts are visible immediately ("12 reminded").
create table if not exists public.mcb_reminders (
  box_id uuid not null references public.mcb_chatterboxes(id) on delete cascade,
  user_id uuid not null references public.mcb_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (box_id, user_id)
);

alter table public.mcb_reminders enable row level security;

drop policy if exists mcb_reminders_select on public.mcb_reminders;
create policy mcb_reminders_select on public.mcb_reminders
  for select using (true);
drop policy if exists mcb_reminders_insert on public.mcb_reminders;
create policy mcb_reminders_insert on public.mcb_reminders
  for insert with check (auth.uid() = user_id);
drop policy if exists mcb_reminders_delete on public.mcb_reminders;
create policy mcb_reminders_delete on public.mcb_reminders
  for delete using (auth.uid() = user_id);
