-- ================================================================
-- 컬렉션(카테고리) 공유 발행 RPC + 구독 이벤트 조회 RPC
-- ================================================================

-- ----------------------------------------------------------------
-- 1) publish_collection_as_subscription
--    manager/owner만 호출 가능. 이미 카탈로그가 있으면 재활성화.
-- ----------------------------------------------------------------
create or replace function public.publish_collection_as_subscription(
  target_calendar_id uuid,
  target_category_id uuid,
  p_name text,
  p_description text default '',
  p_visibility text default 'public'
)
returns table (
  catalog_id uuid,
  slug text,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id    uuid := auth.uid();
  v_slug         text;
  v_catalog_id   uuid;
  v_color        text;
  v_created      boolean := false;
begin
  -- 권한 확인: manager 또는 owner만 공유 가능
  if not public.has_calendar_role(target_calendar_id, array['manager', 'owner']) then
    raise exception 'permission_denied: manager or owner role required';
  end if;

  -- 카테고리가 해당 캘린더에 속하는지 확인
  if not exists (
    select 1 from public.event_categories
    where id = target_category_id
      and calendar_id = target_calendar_id
  ) then
    raise exception 'not_found: category does not belong to calendar';
  end if;

  -- 카테고리 색상 조회
  select coalesce(
    (ec.options ->> 'color'),
    'gray'
  ) into v_color
  from public.event_categories as ec
  where ec.id = target_category_id;

  -- 슬러그 생성: subscription.shared.<calendar_id>.<category_id>
  v_slug := 'subscription.shared.' || target_calendar_id::text || '.' || target_category_id::text;

  -- 기존 카탈로그 확인 (같은 source_category_id로 이미 발행된 것)
  select id into v_catalog_id
  from public.calendar_subscription_catalogs
  where source_calendar_id = target_calendar_id
    and source_category_id = target_category_id
  limit 1;

  if v_catalog_id is not null then
    -- 기존 카탈로그 업데이트 (재활성화 포함)
    update public.calendar_subscription_catalogs
    set
      name = p_name,
      description = p_description,
      visibility = p_visibility,
      category_color = v_color,
      status = 'active',
      source_deleted_at = null,
      source_deleted_reason = null,
      is_active = true,
      updated_at = now()
    where id = v_catalog_id;

    return query select v_catalog_id, v_slug, false;
    return;
  end if;

  -- 새 카탈로그 생성
  insert into public.calendar_subscription_catalogs (
    slug,
    name,
    description,
    source_type,
    visibility,
    verified,
    category_color,
    config,
    owner_user_id,
    source_calendar_id,
    source_category_id,
    created_by
  ) values (
    v_slug,
    p_name,
    p_description,
    'shared_category',
    p_visibility,
    false,
    v_color,
    jsonb_build_object(
      'source_calendar_id', target_calendar_id,
      'source_category_id', target_category_id
    ),
    v_caller_id,
    target_calendar_id,
    target_category_id,
    v_caller_id
  )
  returning id into v_catalog_id;

  v_created := true;

  return query select v_catalog_id, v_slug, true;
end;
$$;

grant execute on function public.publish_collection_as_subscription(uuid, uuid, text, text, text) to authenticated;

-- ----------------------------------------------------------------
-- 2) unpublish_collection_subscription
--    manager/owner만 호출 가능. 카탈로그를 archived 처리.
-- ----------------------------------------------------------------
create or replace function public.unpublish_collection_subscription(
  target_calendar_id uuid,
  target_category_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_catalog_id uuid;
begin
  if not public.has_calendar_role(target_calendar_id, array['manager', 'owner']) then
    raise exception 'permission_denied: manager or owner role required';
  end if;

  select id into v_catalog_id
  from public.calendar_subscription_catalogs
  where source_calendar_id = target_calendar_id
    and source_category_id = target_category_id
    and is_active = true
  limit 1;

  if v_catalog_id is null then
    return false;
  end if;

  update public.calendar_subscription_catalogs
  set
    status = 'archived',
    is_active = false,
    updated_at = now()
  where id = v_catalog_id;

  return true;
end;
$$;

grant execute on function public.unpublish_collection_subscription(uuid, uuid) to authenticated;

-- ----------------------------------------------------------------
-- 3) get_shared_collection_subscription_events
--    구독 설치자가 source_category의 이벤트를 조회하는 RPC.
--    구독 카탈로그 ID(catalog_id)로 호출.
--    설치된 캘린더 소유자만 조회 가능.
-- ----------------------------------------------------------------
create or replace function public.get_shared_collection_subscription_events(
  p_catalog_id uuid,
  p_calendar_id uuid,
  p_range_start timestamptz default null,
  p_range_end   timestamptz default null
)
returns table (
  id         uuid,
  title      text,
  content    jsonb,
  start_at   timestamptz,
  end_at     timestamptz,
  all_day    boolean,
  timezone   text,
  status     text,
  recurrence jsonb,
  exceptions text[],
  category_id uuid,
  category_name text,
  category_color text
)
language plpgsql
security definer
stable
set search_path = ''
as $$
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
    e.id,
    e.title,
    e.content,
    e.start_at,
    e.end_at,
    e.all_day,
    e.timezone,
    e.status,
    e.recurrence,
    e.exceptions,
    ec.id as category_id,
    ec.name as category_name,
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

grant execute on function public.get_shared_collection_subscription_events(uuid, uuid, timestamptz, timestamptz) to authenticated;

-- ----------------------------------------------------------------
-- 4) get_collection_publish_status
--    현재 캘린더의 각 카테고리별 공유 발행 상태 조회.
--    manager/owner만 호출 가능.
-- ----------------------------------------------------------------
create or replace function public.get_collection_publish_status(
  target_calendar_id uuid
)
returns table (
  category_id  uuid,
  catalog_id   uuid,
  is_published boolean,
  visibility   text,
  status       text,
  subscriber_count bigint
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    ec.id as category_id,
    cat.id as catalog_id,
    cat.id is not null and cat.is_active = true and cat.status = 'active' as is_published,
    cat.visibility,
    cat.status,
    coalesce(
      (
        select count(*)
        from public.calendar_subscription_installs as i
        where i.subscription_catalog_id = cat.id
      ),
      0
    ) as subscriber_count
  from public.event_categories as ec
  left join public.calendar_subscription_catalogs as cat
    on cat.source_calendar_id = target_calendar_id
   and cat.source_category_id = ec.id
   and cat.source_type = 'shared_category'
  where ec.calendar_id = target_calendar_id
    and public.has_calendar_role(target_calendar_id, array['manager', 'owner'])
  order by ec.created_at asc;
$$;

grant execute on function public.get_collection_publish_status(uuid) to authenticated;
