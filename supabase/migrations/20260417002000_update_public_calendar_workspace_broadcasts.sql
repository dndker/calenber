create or replace function public.is_calendar_workspace_topic_private(
  target_calendar_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select not public.is_calendar_publicly_viewable(target_calendar_id);
$$;

create or replace function public.broadcast_calendar_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_calendar_id uuid := coalesce(new.calendar_id, old.calendar_id);
  target_event_id uuid := coalesce(new.id, old.id);
  target_topic text := public.get_calendar_workspace_topic(target_calendar_id);
  target_is_private boolean := public.is_calendar_workspace_topic_private(target_calendar_id);
  target_event_name text;
  target_payload jsonb;
begin
  target_event_name := case tg_op
    when 'INSERT' then 'calendar.event.created'
    when 'UPDATE' then 'calendar.event.updated'
    when 'DELETE' then 'calendar.event.deleted'
    else 'calendar.event.changed'
  end;

  target_payload := jsonb_build_object(
    'entity', 'event',
    'operation', lower(tg_op),
    'calendarId', target_calendar_id,
    'eventId', target_event_id,
    'occurredAt', timezone('utc', now())
  );

  if tg_op = 'DELETE' then
    target_payload := target_payload || jsonb_build_object(
      'record',
      jsonb_build_object(
        'id', old.id,
        'calendar_id', old.calendar_id
      )
    );
  else
    target_payload := target_payload || jsonb_build_object(
      'record',
      public.build_calendar_event_realtime_record(target_event_id)
    );
  end if;

  perform realtime.send(
    target_payload,
    target_event_name,
    target_topic,
    target_is_private
  );

  return null;
end;
$$;
