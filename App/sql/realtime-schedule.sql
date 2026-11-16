-- Live schedule updates: send changes to schedule_entries and shift_overrides
-- to open apps over Supabase Realtime. Safe to run more than once.
-- Realtime still applies each table's RLS select policy per user.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'schedule_entries') then
    alter publication supabase_realtime add table public.schedule_entries;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shift_overrides') then
    alter publication supabase_realtime add table public.shift_overrides;
  end if;
end $$;
