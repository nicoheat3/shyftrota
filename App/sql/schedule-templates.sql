-- ShyftRota: saved schedule templates (a week's pattern you can reapply).
-- Only admins of the property can see, save or delete them.
-- Safe to run more than once.

begin;

create table if not exists public.schedule_templates (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  name         text not null check (length(name) between 1 and 60),
  pattern      jsonb not null default '{}'::jsonb,  -- { "Mon": { "<employee id>": "<shift id>" }, ... }
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists schedule_templates_property_idx on public.schedule_templates (property_id);

alter table public.schedule_templates enable row level security;

drop policy if exists "schedule_templates_admin_all" on public.schedule_templates;
create policy "schedule_templates_admin_all" on public.schedule_templates
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.property_id = schedule_templates.property_id)
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.property_id = schedule_templates.property_id)
  );

commit;

-- Check it worked (should return the table name, not null):
-- select to_regclass('public.schedule_templates');
