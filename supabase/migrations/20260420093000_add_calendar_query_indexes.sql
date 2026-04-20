create index if not exists calendar_members_user_status_calendar_idx
on public.calendar_members (user_id, status, calendar_id);

create index if not exists calendar_members_calendar_user_idx
on public.calendar_members (calendar_id, user_id);

create index if not exists events_calendar_start_created_idx
on public.events (calendar_id, start_at, created_at);
