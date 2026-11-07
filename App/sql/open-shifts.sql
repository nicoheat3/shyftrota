-- ShyftRota: Open Shifts move from each phone's local storage to the database.
-- Admins post, assign, approve, decline and remove. Employees see their
-- property's open shifts and claim one through claim_open_shift().
-- Safe to run more than once.

begin;

create table if not exists public.open_shifts (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  work_date     date not null,
  shift_id      text not null,
  role          text,
  note          text,
  posted_by     uuid default auth.uid(),
  posted_name   text,
  status        text not null default 'open' check (status in ('open', 'pending_approval', 'filled')),
  claimed_by    bigint,
  claimed_name  text,
  created_at    timestamptz not null default now()
);
create index if not exists open_shifts_property_date_idx on public.open_shifts (property_id, work_date);

alter table public.open_shifts enable row level security;

-- Everyone at the property can see its open shifts.
drop policy if exists "open_shifts_select_property" on public.open_shifts;
create policy "open_shifts_select_property" on public.open_shifts
  for select using (
    property_id in (select p.property_id from public.profiles p where p.id = auth.uid())
  );

-- Only admins of the property can add, change or remove them directly.
drop policy if exists "open_shifts_admin_insert" on public.open_shifts;
create policy "open_shifts_admin_insert" on public.open_shifts
  for insert with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.property_id = open_shifts.property_id)
  );

drop policy if exists "open_shifts_admin_update" on public.open_shifts;
create policy "open_shifts_admin_update" on public.open_shifts
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.property_id = open_shifts.property_id)
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.property_id = open_shifts.property_id)
  );

drop policy if exists "open_shifts_admin_delete" on public.open_shifts;
create policy "open_shifts_admin_delete" on public.open_shifts
  for delete using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.property_id = open_shifts.property_id)
  );

-- Employees claim through this function. It takes who they are from their
-- profile (never from the browser) and only claims a shift that is still
-- open, so two people tapping at once can't both get it.
create or replace function public.claim_open_shift(p_id uuid)
returns public.open_shifts
language plpgsql
security definer
set search_path = public
as $$
declare
  prof record;
  emp_name text;
  v_row public.open_shifts;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select employee_id, property_id into prof from public.profiles where id = auth.uid();
  if prof.employee_id is null then raise exception 'no employee profile'; end if;
  select name into emp_name from public.employees where id = prof.employee_id;

  update public.open_shifts
     set status = 'pending_approval', claimed_by = prof.employee_id, claimed_name = emp_name
   where id = p_id and property_id = prof.property_id and status = 'open' and work_date >= current_date - 1  -- server clock is UTC; allow late-evening claims for today
  returning * into v_row;

  if v_row.id is null then raise exception 'shift already taken'; end if;
  return v_row;
end;
$$;

revoke all on function public.claim_open_shift(uuid) from public, anon;
grant execute on function public.claim_open_shift(uuid) to authenticated;

commit;

-- Check it worked (should return the table and the function, not nulls):
-- select to_regclass('public.open_shifts'), to_regprocedure('public.claim_open_shift(uuid)');
