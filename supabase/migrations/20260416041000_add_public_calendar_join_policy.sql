create policy "users can join public calendars"
on public.calendar_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'editor'
  and (
    (
      status = 'active'
      and exists (
        select 1
        from public.calendars
        where calendars.id = calendar_members.calendar_id
          and calendars.access_mode = 'public_open'
      )
    )
    or (
      status = 'pending'
      and exists (
        select 1
        from public.calendars
        where calendars.id = calendar_members.calendar_id
          and calendars.access_mode = 'public_approval'
      )
    )
  )
);
