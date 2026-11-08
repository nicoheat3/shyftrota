-- ShyftRota: small security cleanup from the Supabase security advisor.
-- Nothing in the app changes. Safe to run more than once.

begin;

-- Pin the search path on the two helper functions your security rules use,
-- so they can't be tricked into reading a look-alike table.
alter function public.is_admin() set search_path = public;
alter function public.my_property_id() set search_path = public;

-- Signed-out visitors have no reason to call these.
revoke execute on function public.is_admin() from anon, public;
revoke execute on function public.my_property_id() from anon, public;
revoke execute on function public.chat_set_sender() from anon, authenticated, public;
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;

-- Signed-in users still need the two helpers (your security rules call them).
grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_property_id() to authenticated;

commit;
