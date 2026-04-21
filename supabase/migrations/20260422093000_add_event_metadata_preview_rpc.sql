drop function if exists public.get_calendar_event_metadata_preview(uuid);

create or replace function public.get_calendar_event_metadata_preview(
  target_event_id uuid
)
returns table (
  id uuid,
  title text,
  start_at timestamptz,
  end_at timestamptz,
  status public.calendar_event_status,
  creator_name text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    public.is_active_calendar_member(
      (select events.calendar_id from public.events as events where events.id = target_event_id)
    )
    or public.is_calendar_publicly_viewable(
      (select events.calendar_id from public.events as events where events.id = target_event_id)
    )
  ) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  return query
  select
    events.id,
    events.title,
    events.start_at,
    events.end_at,
    events.status,
    nullif(trim(creators.raw_user_meta_data ->> 'name'), '')::text
  from public.events as events
  left join auth.users as creators on creators.id = events.created_by
  where events.id = target_event_id;
end;
$$;

grant execute on function public.get_calendar_event_metadata_preview(uuid) to authenticated, anon;
