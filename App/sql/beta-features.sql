-- Beta features: try new features at one property before everyone.
--
-- beta_program   Only Nicolas turns this on (Supabase SQL editor or table editor).
--                Properties not in the program never see the Beta features section.
-- beta_features  Which beta features this property has switched on, e.g. {"supplies": true}.
--                Managers change this from Settings.
-- beta_audience  'managers' (default) or 'everyone'. Who sees the features that are on.
--
-- To put a property in the program:
--   update public.properties set beta_program = true where id = '<property id>';

alter table public.properties
  add column if not exists beta_program  boolean not null default false,
  add column if not exists beta_features jsonb   not null default '{}'::jsonb,
  add column if not exists beta_audience text    not null default 'managers';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'properties_beta_audience_check') then
    alter table public.properties
      add constraint properties_beta_audience_check check (beta_audience in ('managers', 'everyone'));
  end if;
end $$;

-- Managers can update their property's settings, so stop them from joining the
-- beta program themselves. Only the service role or the SQL editor can change it.
create or replace function public.guard_beta_program()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.beta_program is distinct from old.beta_program
     and current_user in ('authenticated', 'anon') then
    raise exception 'Only ShyftRota can change the beta program for a property';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_beta_program on public.properties;
create trigger guard_beta_program
  before update on public.properties
  for each row execute function public.guard_beta_program();
