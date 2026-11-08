-- ShyftRota: private calendar feed links (Apple/Google Calendar sync).
-- Each employee gets a secret link. Calendar apps can't sign in, so the
-- link itself is the key; anyone can reset theirs to cut off an old one.
-- Nobody can read this table directly; the app goes through the two
-- functions below, and the calendar server function uses the server key.
-- Safe to run more than once.

begin;

create table if not exists public.calendar_feeds (
  employee_id  bigint primary key,
  property_id  uuid not null references public.properties(id) on delete cascade,
  token        text not null unique,
  created_at   timestamptz not null default now()
);

alter table public.calendar_feeds enable row level security;
-- (no policies on purpose: no direct reads or writes from the browser)

-- Your link: returns your token, creating one the first time.
create or replace function public.get_calendar_token()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare prof record; tok text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select employee_id, property_id into prof from public.profiles where id = auth.uid();
  if prof.employee_id is null then raise exception 'no employee profile'; end if;
  select token into tok from public.calendar_feeds where employee_id = prof.employee_id;
  if tok is null then
    tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    insert into public.calendar_feeds (employee_id, property_id, token)
    values (prof.employee_id, prof.property_id, tok)
    on conflict (employee_id) do update set token = excluded.token, property_id = excluded.property_id;
  end if;
  return tok;
end;
$$;

-- Reset your link: the old one stops working.
create or replace function public.reset_calendar_token()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare prof record; tok text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select employee_id, property_id into prof from public.profiles where id = auth.uid();
  if prof.employee_id is null then raise exception 'no employee profile'; end if;
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.calendar_feeds (employee_id, property_id, token)
  values (prof.employee_id, prof.property_id, tok)
  on conflict (employee_id) do update set token = excluded.token, property_id = excluded.property_id, created_at = now();
  return tok;
end;
$$;

revoke all on function public.get_calendar_token() from public, anon;
revoke all on function public.reset_calendar_token() from public, anon;
grant execute on function public.get_calendar_token() to authenticated;
grant execute on function public.reset_calendar_token() to authenticated;

commit;

-- Check it worked (should return the table and both functions, not nulls):
-- select to_regclass('public.calendar_feeds'), to_regprocedure('public.get_calendar_token()'), to_regprocedure('public.reset_calendar_token()');
