create or replace function public.is_calendar_publicly_viewable(
  target_calendar_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.calendars
    where id = target_calendar_id
      and access_mode in ('public_open', 'public_approval')
  );
$$;

drop policy if exists "users can view their calendars" on public.calendars;
create policy "users can view visible calendars"
on public.calendars
for select
using (
  public.is_active_calendar_member(id)
  or public.is_calendar_publicly_viewable(id)
);

drop policy if exists "users can view events" on public.events;
drop policy if exists "users can view public events" on public.events;
create policy "users can view visible events"
on public.events
for select
using (
  public.is_active_calendar_member(calendar_id)
  or public.is_calendar_publicly_viewable(calendar_id)
);
