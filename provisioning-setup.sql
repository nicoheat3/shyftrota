-- ShyftRota: one-time setup for customer provisioning.
-- Run this once in the Supabase SQL editor, before using /provision.html.
-- Safe to run more than once: every statement is idempotent.

-- The app never stored a property name, because there was only ever one
-- property. Provisioning needs it so you can tell customers apart.
alter table public.properties
  add column if not exists name text;

-- Give the existing property a name if it hasn't got one.
update public.properties
   set name = 'Del Mar'
 where name is null;

-- Record when each workspace was created, so you can see trial age at a glance.
alter table public.properties
  add column if not exists created_at timestamptz not null default now();

-- Quick look at every workspace and who administers it.
-- Run this any time to see your customer list.
--
--   select p.name,
--          p.room_count,
--          p.created_at::date as created,
--          count(e.id)        as employees,
--          string_agg(pr.name, ', ') filter (where pr.role = 'admin') as admins
--     from public.properties p
--     left join public.employees e  on e.property_id  = p.id
--     left join public.profiles  pr on pr.property_id = p.id
--    group by p.id, p.name, p.room_count, p.created_at
--    order by p.created_at desc;
