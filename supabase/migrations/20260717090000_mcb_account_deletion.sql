-- In-app account deletion (Apple guideline 5.1.1(v); FR-12.3 delete right).
-- Deleting an auth user must cascade cleanly through every mcb_ table.
-- mcb_participants.removed_by was declared with no delete action, which would
-- abort auth.admin.deleteUser for any user who ever removed a participant.
alter table public.mcb_participants
  drop constraint if exists mcb_participants_removed_by_fkey;
alter table public.mcb_participants
  add constraint mcb_participants_removed_by_fkey
    foreign key (removed_by) references auth.users(id) on delete set null;
