-- ShyftRota: audit log in the database instead of each phone.
-- The app records actions through log_audit(), which takes who did it and
-- which property from the signed-in profile (never from the browser).
-- Admins can read their property's log. Nobody can edit or delete entries.
-- Safe to run more than once.

begin;

create table if not exists public.audit_log (
  id           bigint generated always as identity primary key,
  property_id  uuid not null references public.properties(id) on delete cascade,
  user_id      uuid,
  actor_name   text,
  action       text not null,
  detail       text,
  created_at   timestamptz not null default now()
);
create index if not exists audit_log_property_time_idx on public.audit_log (property_id, created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "audit_log_admin_read" on public.audit_log;
create policy "audit_log_admin_read" on public.audit_log
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.property_id = audit_log.property_id)
  );

-- No insert/update/delete policies: entries only go in through this function.
create or replace function public.log_audit(p_action text, p_detail text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare prof record; emp_name text;
begin
  if auth.uid() is null then return; end if;
  select employee_id, property_id, name into prof from public.profiles where id = auth.uid();
  if prof.property_id is null then return; end if;
  select name into emp_name from public.employees where id = prof.employee_id;
  insert into public.audit_log (property_id, user_id, actor_name, action, detail)
  values (prof.property_id, auth.uid(), coalesce(emp_name, prof.name), left(p_action, 60), left(p_detail, 500));
end;
$$;

revoke all on function public.log_audit(text, text) from public, anon;
grant execute on function public.log_audit(text, text) to authenticated;

commit;

-- Check it worked (should return the table and the function, not nulls):
-- select to_regclass('public.audit_log'), to_regprocedure('public.log_audit(text,text)');
