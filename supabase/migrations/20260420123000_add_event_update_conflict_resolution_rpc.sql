drop function if exists public.update_calendar_event_with_conflict_resolution(uuid, timestamptz, jsonb, text[]);

create or replace function public.update_calendar_event_with_conflict_resolution(
  target_event_id uuid,
  expected_updated_at timestamptz,
  patch jsonb,
  changed_fields text[]
)
returns table (
  status text,
  conflicting_fields text[],
  record jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_event public.events;
  remote_changed_fields text[] := array[]::text[];
  overlapping_fields text[] := array[]::text[];
begin
  select *
  into current_event
  from public.events as events
  where events.id = target_event_id
  for update;

  if not found then
    return query
    select
      'not_found'::text,
      array[]::text[],
      null::jsonb;
    return;
  end if;

  if not public.can_update_calendar_event(
    current_event.calendar_id,
    current_event.created_by,
    current_event.is_locked
  ) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  if current_event.updated_at is distinct from expected_updated_at then
    select coalesce(
      array_agg(distinct field_name),
      array[]::text[]
    )
    into remote_changed_fields
    from (
      select change_entry ->> 'field' as field_name
      from public.event_history as history
      cross join lateral jsonb_array_elements(history.changes) as change_entry
      where history.event_id = target_event_id
        and history.action = 'updated'
        and history.occurred_at > expected_updated_at
        and history.actor_user_id is distinct from auth.uid()
        and change_entry ? 'field'
    ) as changed;

    select coalesce(
      array_agg(distinct field_name),
      array[]::text[]
    )
    into overlapping_fields
    from (
      select unnest(coalesce(changed_fields, array[]::text[])) as field_name
      intersect
      select unnest(remote_changed_fields) as field_name
    ) as overlapping;

    if coalesce(array_length(overlapping_fields, 1), 0) > 0 then
      return query
      select
        'conflict'::text,
        overlapping_fields,
        public.build_calendar_event_realtime_record(target_event_id);
      return;
    end if;
  end if;

  update public.events as events
  set
    title = case
      when patch ? 'title' then patch ->> 'title'
      else events.title
    end,
    content = case
      when patch ? 'content' then patch -> 'content'
      else events.content
    end,
    start_at = case
      when patch ? 'start_at' then (patch ->> 'start_at')::timestamptz
      else events.start_at
    end,
    end_at = case
      when patch ? 'end_at' then (patch ->> 'end_at')::timestamptz
      else events.end_at
    end,
    status = case
      when patch ? 'status' then (patch ->> 'status')::public.calendar_event_status
      else events.status
    end,
    is_locked = case
      when patch ? 'is_locked' then (patch ->> 'is_locked')::boolean
      else events.is_locked
    end
  where events.id = target_event_id;

  return query
  select
    case
      when current_event.updated_at is distinct from expected_updated_at then 'merged'
      else 'updated'
    end::text,
    array[]::text[],
    public.build_calendar_event_realtime_record(target_event_id);
end;
$$;

grant execute on function public.update_calendar_event_with_conflict_resolution(uuid, timestamptz, jsonb, text[]) to authenticated;
