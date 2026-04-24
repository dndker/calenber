create or replace function public.get_default_calendar_event_field_settings () returns jsonb language sql immutable
set
    search_path = '' as $$
  select jsonb_build_object(
    'version',
    1,
    'items',
    jsonb_build_array(
      jsonb_build_object('id', 'schedule', 'visible', true),
      jsonb_build_object('id', 'participants', 'visible', false),
      jsonb_build_object('id', 'categories', 'visible', true),
      jsonb_build_object('id', 'status', 'visible', false),
      jsonb_build_object('id', 'recurrence', 'visible', false),
      jsonb_build_object('id', 'exceptions', 'visible', false),
      jsonb_build_object('id', 'timezone', 'visible', false),
      jsonb_build_object('id', 'place', 'visible', false),
      jsonb_build_object('id', 'notification', 'visible', false)
    )
  );
$$;

update public.calendars
set event_field_settings = public.get_default_calendar_event_field_settings ();
