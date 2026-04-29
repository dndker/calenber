create or replace function public.build_calendar_settings_realtime_record (target_calendar_id uuid) returns jsonb language sql security definer
set
    search_path = '' as $$
  select jsonb_build_object(
    'id', calendars.id,
    'name', calendars.name,
    'avatar_url', calendars.avatar_url,
    'access_mode', calendars.access_mode,
    'event_layout', calendars.event_layout,
    'event_field_settings', calendars.event_field_settings,
    'layout_options', calendars.layout_options,
    'updated_at', calendars.updated_at
  )
  from public.calendars as calendars
  where calendars.id = target_calendar_id;
$$;

create or replace function public.broadcast_calendar_settings_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_topic text := public.get_calendar_workspace_topic(new.id);
  target_is_private boolean := public.is_calendar_workspace_topic_private(new.id);
begin
  if old.name is not distinct from new.name
     and old.avatar_url is not distinct from new.avatar_url
     and old.access_mode is not distinct from new.access_mode
     and old.event_layout is not distinct from new.event_layout
     and old.event_field_settings is not distinct from new.event_field_settings
     and old.layout_options is not distinct from new.layout_options then
    return null;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'entity', 'calendar_settings',
      'operation', 'update',
      'calendarId', new.id,
      'occurredAt', timezone('utc', now()),
      'record', public.build_calendar_settings_realtime_record(new.id)
    ),
    'calendar.settings.updated',
    target_topic,
    target_is_private
  );

  return null;
end;
$$;

drop trigger if exists broadcast_calendar_settings_change on public.calendars;

create trigger broadcast_calendar_settings_change
after update of name, avatar_url, access_mode, event_layout, event_field_settings, layout_options on public.calendars
for each row
execute function public.broadcast_calendar_settings_change();
