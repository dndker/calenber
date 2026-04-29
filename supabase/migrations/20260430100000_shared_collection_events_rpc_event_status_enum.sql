-- ================================================================
-- get_shared_collection_subscription_events: 반환 타입과 events.status 정합
-- events.status 는 public.calendar_event_status enum 이므로 RETURNS TABLE 의
-- event_status 를 text 가 아닌 동일 enum 으로 선언한다 (42804 방지).
-- ================================================================
drop function if exists public.get_shared_collection_subscription_events (uuid, uuid, timestamptz, timestamptz);

create function public.get_shared_collection_subscription_events (
    p_catalog_id uuid,
    p_calendar_id uuid,
    p_range_start timestamptz default null,
    p_range_end   timestamptz default null
) returns table (
    event_id uuid,
    title text,
    content jsonb,
    start_at timestamptz,
    end_at timestamptz,
    all_day boolean,
    timezone text,
    event_status public.calendar_event_status,
    recurrence jsonb,
    exceptions jsonb,
    collection_id uuid,
    collection_name text,
    collection_color text
) language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_source_calendar_id uuid;
  v_source_collection_id uuid;
begin
  if not exists (
    select 1
    from public.calendar_subscription_installs as i
    where i.subscription_catalog_id = p_catalog_id
      and i.calendar_id = p_calendar_id
      and public.is_active_calendar_member(p_calendar_id)
  ) then
    raise exception 'permission_denied: subscription not installed';
  end if;

  select csc.source_calendar_id, csc.source_collection_id
  into v_source_calendar_id, v_source_collection_id
  from public.calendar_subscription_catalogs as csc
  where csc.id = p_catalog_id
    and csc.source_type = 'shared_collection'
    and csc.is_active = true
    and csc.status = 'active';

  if v_source_calendar_id is null or v_source_collection_id is null then
    return;
  end if;

  return query
  select
    e.id        as event_id,
    e.title,
    e.content,
    e.start_at,
    e.end_at,
    e.all_day,
    e.timezone,
    e.status    as event_status,
    e.recurrence,
    e.exceptions,
    ec.id       as collection_id,
    ec.name     as collection_name,
    coalesce(ec.options ->> 'color', 'gray') as collection_color
  from public.events as e
  left join public.event_collections as ec
    on ec.id = e.primary_collection_id
  where e.calendar_id = v_source_calendar_id
    and e.primary_collection_id = v_source_collection_id
    and (p_range_start is null or e.end_at >= p_range_start)
    and (p_range_end   is null or e.start_at <= p_range_end)
  order by e.start_at asc;
end;
$$;

revoke all on function public.get_shared_collection_subscription_events (uuid, uuid, timestamptz, timestamptz)
from public;

grant execute on function public.get_shared_collection_subscription_events (uuid, uuid, timestamptz, timestamptz)
to authenticated;
