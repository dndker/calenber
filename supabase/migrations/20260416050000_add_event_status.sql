do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'calendar_event_status'
  ) then
    create type public.calendar_event_status as enum (
      'scheduled',
      'in_progress',
      'completed',
      'cancelled'
    );
  end if;
end
$$;

alter table public.events
add column if not exists status public.calendar_event_status not null default 'scheduled';
