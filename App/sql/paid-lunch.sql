-- ShyftRota: let a shift type skip the 30-minute unpaid lunch deduction
-- (e.g. night audit). Safe to run more than once.
alter table public.shift_defs
  add column if not exists paid_lunch boolean not null default false;

-- Check it worked (should list paid_lunch):
-- select column_name from information_schema.columns where table_name = 'shift_defs' and column_name = 'paid_lunch';
