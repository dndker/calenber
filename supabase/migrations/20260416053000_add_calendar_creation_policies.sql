drop policy if exists "users can create own calendars" on public.calendars;
create policy "users can create own calendars"
on public.calendars
for insert
to authenticated
with check (
  created_by = auth.uid()
);

drop policy if exists "users can create initial owner membership" on public.calendar_members;
create policy "users can create initial owner membership"
on public.calendar_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'owner'
  and status = 'active'
  and exists (
    select 1
    from public.calendars
    where calendars.id = calendar_members.calendar_id
      and calendars.created_by = auth.uid()
  )
);
