-- ShyftRota: phone notifications (web push)
-- Stores which phones/browsers want notifications. Safe to run more than once.

begin;

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid(),
  employee_id  bigint,
  property_id  uuid not null references public.properties(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists push_subscriptions_property_idx on public.push_subscriptions (property_id, employee_id);

alter table public.push_subscriptions enable row level security;

-- People can see and remove only their own devices. Saving goes through the
-- function below, which takes the employee and property from the profile
-- (never from the browser).
drop policy if exists "push_subs_select_own" on public.push_subscriptions;
create policy "push_subs_select_own" on public.push_subscriptions
  for select using (user_id = auth.uid());

drop policy if exists "push_subs_delete_own" on public.push_subscriptions;
create policy "push_subs_delete_own" on public.push_subscriptions
  for delete using (user_id = auth.uid());

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare prof record;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select employee_id, property_id into prof from public.profiles where id = auth.uid();
  if prof.property_id is null then raise exception 'no profile'; end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 then raise exception 'bad endpoint'; end if;

  -- One row per device. If someone else signed in on this phone before,
  -- the device now belongs to whoever is signed in.
  insert into public.push_subscriptions (user_id, employee_id, property_id, endpoint, p256dh, auth, user_agent, last_used_at)
  values (auth.uid(), prof.employee_id, prof.property_id, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 200), now())
  on conflict (endpoint) do update
    set user_id = excluded.user_id, employee_id = excluded.employee_id, property_id = excluded.property_id,
        p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent, last_used_at = now();
end;
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

commit;

-- Check it worked (should list the table and the function):
-- select to_regclass('public.push_subscriptions'), to_regprocedure('public.save_push_subscription(text,text,text,text)');
