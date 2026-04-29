-- ================================================================
-- get_shared_collection_subscription_events: "status" 모호성 제거
-- RETURNS TABLE(status text) 출력 변수와 calendar_subscription_catalogs.status,
-- 및 events.status 참조가 충돌하여 42702 발생함.
-- 반환 컬럼명을 event_status로 통일하고, 카탈로그 필터는 테이블 별칭으로 한정.
-- ================================================================
drop function if exists public.get_shared_collection_subscription_events (uuid, uuid, timestamptz, timestamptz);

create function public.get_shared_collection_subscription_events (
    p_catalog_id uuid,
    p_calendar_id uuid,
    p_range_start timestamptz default null,
    p_range_end timestamptz default null
) returns table (
    event_id uuid,
    title text,
    content jsonb,
    start_at timestamptz,
    end_at timestamptz,
    all_day boolean,
    timezone text,
    event_status text,
    recurrence jsonb,
    exceptions jsonb,
    collection_id uuid,
    collection_name text,
    collection_color text
) language plpgsql security definer stable
set
    search_path = '' as $$
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
from
    public;

grant
execute on function public.get_shared_collection_subscription_events (uuid, uuid, timestamptz, timestamptz) to authenticated;
