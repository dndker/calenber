-- ================================================================
-- get_shared_collection_subscription_events RPC 수정
-- 반환 컬럼 'id' → 'event_id' 로 rename하여
-- PL/pgSQL 내부에서 e.id 와 충돌하는 ambiguous column reference 해소
-- RETURNS TABLE 변경은 CREATE OR REPLACE 불가 → DROP 후 재생성
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
    status text,
    recurrence jsonb,
    exceptions text[],
    category_id uuid,
    category_name text,
    category_color text
) language plpgsql security definer stable
set
    search_path = '' as $$
declare
  v_source_calendar_id uuid;
  v_source_category_id uuid;
begin
  -- 설치 여부 확인: 호출자의 캘린더에 이 구독이 설치되어 있어야 함
  if not exists (
    select 1
    from public.calendar_subscription_installs as i
    where i.subscription_catalog_id = p_catalog_id
      and i.calendar_id = p_calendar_id
      and public.is_active_calendar_member(p_calendar_id)
  ) then
    raise exception 'permission_denied: subscription not installed';
  end if;

  -- 원본 캘린더/카테고리 조회
  select source_calendar_id, source_category_id
  into v_source_calendar_id, v_source_category_id
  from public.calendar_subscription_catalogs
  where id = p_catalog_id
    and source_type = 'shared_category'
    and is_active = true
    and status = 'active';

  if v_source_calendar_id is null or v_source_category_id is null then
    return;
  end if;

  -- 원본 이벤트 반환 (날짜 범위 필터 선택적)
  return query
  select
    e.id        as event_id,
    e.title,
    e.content,
    e.start_at,
    e.end_at,
    e.all_day,
    e.timezone,
    e.status,
    e.recurrence,
    e.exceptions,
    ec.id       as category_id,
    ec.name     as category_name,
    coalesce(ec.options ->> 'color', 'gray') as category_color
  from public.events as e
  left join public.event_categories as ec
    on ec.id = e.category_id
  where e.calendar_id = v_source_calendar_id
    and e.category_id = v_source_category_id
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
