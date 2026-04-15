create or replace function public.is_calendar_member(target_calendar_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.calendar_members
    where calendar_id = target_calendar_id
      and user_id = auth.uid()
  );
$$;

drop policy if exists "users can view their calendars" on public.calendars;
create policy "users can view their calendars"
on public.calendars
for select
using (public.is_calendar_member(id));

drop policy if exists "users can view members" on public.calendar_members;
create policy "users can view members"
on public.calendar_members
for select
using (public.is_calendar_member(calendar_id));

drop policy if exists "users can access events" on public.events;
create policy "users can access events"
on public.events
for all
using (public.is_calendar_member(calendar_id));
