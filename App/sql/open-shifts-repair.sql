-- ShyftRota: repair open_shifts and close the claim loophole.
--
-- 1. The live table was created by an older script, so open-shifts.sql's
--    "create table if not exists" skipped it. Posting failed because the
--    table had a bigint id with no default and lacked role, note,
--    posted_by, posted_name and claimed_name. This brings it in line
--    with what the app writes (uuid id, statuses open/pending_approval/filled).
-- 2. Drops open_shifts_claim, which let any employee UPDATE any column
--    of any open shift at their property. Employees now claim only
--    through claim_open_shift(), which sets claimed_by from their own
--    profile and only takes a shift that is still open.
--
-- The id conversion only runs while the table is empty. Safe to run more than once.

begin;

do $$
begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'open_shifts' and column_name = 'id') <> 'uuid' then
    if exists (select 1 from public.open_shifts) then
      raise exception 'open_shifts has rows; convert the id by hand';
    end if;
    alter table public.open_shifts alter column id drop identity if exists;
    alter table public.open_shifts alter column id drop default;
    alter table public.open_shifts alter column id type uuid using gen_random_uuid();
  end if;
end $$;
alter table public.open_shifts alter column id set default gen_random_uuid();

alter table public.open_shifts add column if not exists role         text;
alter table public.open_shifts add column if not exists note         text;
alter table public.open_shifts add column if not exists posted_by    uuid default auth.uid();
alter table public.open_shifts add column if not exists posted_name  text;
alter table public.open_shifts add column if not exists claimed_name text;

alter table public.open_shifts drop constraint if exists open_shifts_status_check;
update public.open_shifts set status = 'open' where status is null;
alter table public.open_shifts alter column status set default 'open';
alter table public.open_shifts alter column status set not null;
alter table public.open_shifts add constraint open_shifts_status_check
  check (status in ('open', 'pending_approval', 'filled'));

create index if not exists open_shifts_property_date_idx on public.open_shifts (property_id, work_date);

-- The loophole: any employee could update any open shift at their property.
drop policy if exists "open_shifts_claim" on public.open_shifts;

commit;

-- Check it worked: id is uuid, the new columns exist, no open_shifts_claim policy.
-- select column_name, data_type from information_schema.columns
--  where table_schema = 'public' and table_name = 'open_shifts' order by ordinal_position;
-- select policyname, cmd from pg_policies where tablename = 'open_shifts';
