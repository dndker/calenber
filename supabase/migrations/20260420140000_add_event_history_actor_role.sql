drop function if exists public.get_calendar_event_history(uuid, integer, integer);

create or replace function public.get_calendar_event_history(
  target_event_id uuid,
  history_limit integer default 50,
  history_offset integer default 0
)
returns table (
  id uuid,
  calendar_id uuid,
  event_id uuid,
  action public.event_history_action,
  actor_user_id uuid,
  actor_role public.calendar_role,
  summary text,
  changes jsonb,
  occurred_at timestamptz,
  actor_name text,
  actor_email text,
  actor_avatar_url text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_calendar_id uuid;
begin
  select coalesce(
    (
      select events.calendar_id
      from public.events as events
      where events.id = target_event_id
      limit 1
    ),
    (
      select history.calendar_id
      from public.event_history as history
      where history.event_id = target_event_id
      order by history.occurred_at desc
      limit 1
    )
  )
  into resolved_calendar_id;

  if resolved_calendar_id is null then
    return;
  end if;

  if not public.is_active_calendar_member(resolved_calendar_id) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  return query
  select
    history.id,
    history.calendar_id,
    history.event_id,
    history.action,
    history.actor_user_id,
    members.role,
    history.summary,
    history.changes,
    history.occurred_at,
    nullif(trim(users.raw_user_meta_data ->> 'name'), '')::text,
    users.email::text,
    nullif(trim(users.raw_user_meta_data ->> 'avatar_url'), '')::text
  from public.event_history as history
  left join auth.users as users on users.id = history.actor_user_id
  left join public.calendar_members as members
    on members.calendar_id = history.calendar_id
   and members.user_id = history.actor_user_id
   and members.status = 'active'
  where history.calendar_id = resolved_calendar_id
    and history.event_id = target_event_id
  order by history.occurred_at desc, history.id desc
  limit greatest(coalesce(history_limit, 50), 0)
  offset greatest(coalesce(history_offset, 0), 0);
end;
$$;

grant execute on function public.get_calendar_event_history(uuid, integer, integer) to authenticated;
