-- ShyftRota: let managers drag shift types into their own order.
-- Run once in Supabase → SQL Editor. Safe to run again.
-- Existing shift types start out ordered by start time.

alter table public.shift_defs
  add column if not exists sort_order integer;

update public.shift_defs s
   set sort_order = r.rn
  from (select id, property_id, row_number() over (partition by property_id order by start_time, label) - 1 as rn
          from public.shift_defs) r
 where s.id = r.id and s.property_id = r.property_id and s.sort_order is null;
