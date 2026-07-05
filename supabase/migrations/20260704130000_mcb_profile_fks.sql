-- Repoint participant/message user FKs at mcb_profiles so PostgREST can embed
-- profile data (profiles themselves cascade from auth.users, so deletion
-- semantics are unchanged).

alter table public.mcb_participants
  drop constraint if exists mcb_participants_user_id_fkey,
  add constraint mcb_participants_user_id_fkey
    foreign key (user_id) references public.mcb_profiles(id) on delete cascade;

alter table public.mcb_messages
  drop constraint if exists mcb_messages_user_id_fkey,
  add constraint mcb_messages_user_id_fkey
    foreign key (user_id) references public.mcb_profiles(id) on delete cascade;
