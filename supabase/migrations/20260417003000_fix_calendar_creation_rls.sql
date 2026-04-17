create policy "users can view calendars they created"
on public.calendars
for select
to authenticated
using (created_by = auth.uid());
