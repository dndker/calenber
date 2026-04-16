drop policy if exists "calendar workspace realtime public read" on realtime.messages;
create policy "calendar workspace realtime public read"
on realtime.messages
for select
to anon
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and public.can_access_calendar_workspace_topic((select realtime.topic()))
);

drop policy if exists "calendar workspace realtime public presence write" on realtime.messages;
create policy "calendar workspace realtime public presence write"
on realtime.messages
for insert
to anon
with check (
  realtime.messages.extension = 'presence'
  and public.can_access_calendar_workspace_topic((select realtime.topic()))
);
