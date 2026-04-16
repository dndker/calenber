alter table public.calendars
add column if not exists event_layout text not null default 'compact';

alter table public.calendars
drop constraint if exists calendars_event_layout_check;

alter table public.calendars
add constraint calendars_event_layout_check
check (event_layout in ('compact', 'split'));

drop policy if exists "calendar managers can update calendars" on public.calendars;

create policy "calendar managers can update calendars"
on public.calendars
for update
to authenticated
using (
  exists (
    select 1
    from public.calendar_members
    where calendar_id = calendars.id
      and user_id = auth.uid()
      and role in ('manager', 'owner')
  )
)
with check (
  exists (
    select 1
    from public.calendar_members
    where calendar_id = calendars.id
      and user_id = auth.uid()
      and role in ('manager', 'owner')
  )
);
