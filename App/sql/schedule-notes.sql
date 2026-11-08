-- ShyftRota: free-text notes in schedule cells (e.g. "La Jolla", "Training").
-- One note per employee per day per property. Re-runnable; changes nothing that exists.
begin;

create table if not exists public.schedule_notes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id),
  work_date date not null,
  employee_id bigint not null,
  note text not null check (char_length(note) between 1 and 40),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint schedule_notes_unique unique (property_id, work_date, employee_id)
);

alter table public.schedule_notes enable row level security;

-- Everyone at the property can read notes (staff see them in My Schedule).
drop policy if exists schedule_notes_select on public.schedule_notes;
create policy schedule_notes_select on public.schedule_notes
  for select using (property_id = my_property_id());

-- Only admins at the property can add, change or remove notes.
drop policy if exists schedule_notes_admin_write on public.schedule_notes;
create policy schedule_notes_admin_write on public.schedule_notes
  for all using (is_admin() and property_id = my_property_id())
  with check (is_admin() and property_id = my_property_id());

commit;

-- Verify:
-- select policyname, cmd from pg_policies where tablename = 'schedule_notes';
