-- ShyftRota: per-property time clock switch + default schedule layout
-- Run once in Supabase → SQL Editor. Safe to run again.
-- Existing properties keep the time clock ON and the Grid layout.

alter table public.properties
  add column if not exists time_clock boolean not null default true;

alter table public.properties
  add column if not exists default_layout text not null default 'grid';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'properties_default_layout_check') then
    alter table public.properties add constraint properties_default_layout_check
      check (default_layout in ('grid','cards','slots','timeline','list','month'));
  end if;
end $$;
