-- ================================================================
-- 구독 카탈로그 RPC: shared_collection 타입은 collection_color를
-- 스냅샷(catalogs.collection_color) 대신 event_collections.options.color에서
-- 동적으로 읽도록 수정한다.
-- publish_collection_as_subscription이 발행 시점 color를 스냅샷으로 저장하므로
-- 이후 공유자가 color를 변경해도 구독자 화면에는 이전 색상이 고정으로 표시되는
-- 문제가 있다. source_collection_id가 있는 경우 항상 원본 컬렉션에서 읽는다.
-- ================================================================

-- ----------------------------------------------------------------
-- 1) get_calendar_subscription_catalog
-- ----------------------------------------------------------------
drop function if exists public.get_calendar_subscription_catalog(uuid, text);
create or replace function public.get_calendar_subscription_catalog(
  target_calendar_id uuid,
  search_query text default null
)
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  source_type text,
  visibility text,
  verified boolean,
  status text,
  source_deleted_at timestamptz,
  source_deleted_reason text,
  collection_color text,
  config jsonb,
  owner_user_id uuid,
  source_calendar_id uuid,
  source_calendar_name text,
  source_collection_id uuid,
  provider_name text,
  installed boolean,
  is_visible boolean,
  installed_at timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  with normalized_query as (
    select nullif(trim(search_query), '') as q
  )
  select
    catalogs.id,
    catalogs.slug,
    catalogs.name,
    catalogs.description,
    catalogs.source_type,
    catalogs.visibility,
    catalogs.verified,
    catalogs.status,
    catalogs.source_deleted_at,
    catalogs.source_deleted_reason,
    -- shared_collection: 원본 컬렉션의 현재 색상을 동적으로 읽는다.
    -- 그 외(system_holiday 등): 카탈로그에 저장된 스냅샷 색상 사용.
    case
      when catalogs.source_type = 'shared_collection' then
        coalesce(ec.options ->> 'color', catalogs.collection_color, 'gray')
      else
        catalogs.collection_color
    end as collection_color,
    catalogs.config,
    catalogs.owner_user_id,
    catalogs.source_calendar_id,
    calendars.name as source_calendar_name,
    catalogs.source_collection_id,
    case
      when catalogs.source_type = 'system_holiday' then '캘린버'
      else coalesce(
        nullif(trim(owners.raw_user_meta_data ->> 'name'), ''),
        owners.email,
        '공유 사용자'
      )
    end as provider_name,
    installs.id is not null as installed,
    coalesce(installs.is_visible, true) as is_visible,
    installs.created_at as installed_at
  from public.calendar_subscription_catalogs as catalogs
  left join public.calendar_subscription_installs as installs
    on installs.subscription_catalog_id = catalogs.id
   and installs.calendar_id = target_calendar_id
  left join public.calendars as calendars
    on calendars.id = catalogs.source_calendar_id
  left join auth.users as owners
    on owners.id = catalogs.owner_user_id
  left join public.event_collections as ec
    on ec.id = catalogs.source_collection_id
  cross join normalized_query
  where catalogs.is_active = true
    and (
      catalogs.visibility = 'public'
      or catalogs.owner_user_id = auth.uid()
      or (
        catalogs.source_calendar_id is not null
        and public.is_active_calendar_member(catalogs.source_calendar_id)
      )
      or installs.id is not null
    )
    and (
      normalized_query.q is null
      or lower(catalogs.name) like '%' || lower(normalized_query.q) || '%'
      or lower(catalogs.description) like '%' || lower(normalized_query.q) || '%'
      or lower(catalogs.slug) like '%' || lower(normalized_query.q) || '%'
    )
  order by
    installed desc,
    (catalogs.status = 'source_deleted') desc,
    catalogs.verified desc,
    catalogs.created_at desc;
$$;

grant execute on function public.get_calendar_subscription_catalog(uuid, text) to authenticated;

-- ----------------------------------------------------------------
-- 2) get_calendar_installed_subscriptions
-- ----------------------------------------------------------------
drop function if exists public.get_calendar_installed_subscriptions(uuid);
create or replace function public.get_calendar_installed_subscriptions(
  target_calendar_id uuid
)
returns table (
  install_id uuid,
  subscription_catalog_id uuid,
  slug text,
  name text,
  description text,
  source_type text,
  status text,
  source_deleted_at timestamptz,
  source_deleted_reason text,
  collection_color text,
  config jsonb,
  source_calendar_id uuid,
  source_calendar_name text,
  provider_name text,
  is_visible boolean,
  installed_at timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    installs.id as install_id,
    catalogs.id as subscription_catalog_id,
    catalogs.slug,
    catalogs.name,
    catalogs.description,
    catalogs.source_type,
    catalogs.status,
    catalogs.source_deleted_at,
    catalogs.source_deleted_reason,
    -- shared_collection: 원본 컬렉션의 현재 색상을 동적으로 읽는다.
    case
      when catalogs.source_type = 'shared_collection' then
        coalesce(ec.options ->> 'color', catalogs.collection_color, 'gray')
      else
        catalogs.collection_color
    end as collection_color,
    catalogs.config,
    catalogs.source_calendar_id,
    calendars.name as source_calendar_name,
    case
      when catalogs.source_type = 'system_holiday' then '캘린버'
      else coalesce(
        nullif(trim(owners.raw_user_meta_data ->> 'name'), ''),
        owners.email,
        '공유 사용자'
      )
    end as provider_name,
    installs.is_visible,
    installs.created_at as installed_at
  from public.calendar_subscription_installs as installs
  join public.calendar_subscription_catalogs as catalogs
    on catalogs.id = installs.subscription_catalog_id
  left join public.calendars as calendars
    on calendars.id = catalogs.source_calendar_id
  left join auth.users as owners
    on owners.id = catalogs.owner_user_id
  left join public.event_collections as ec
    on ec.id = catalogs.source_collection_id
  where installs.calendar_id = target_calendar_id
    and catalogs.is_active = true
  order by
    (catalogs.status = 'source_deleted') desc,
    installs.created_at asc;
$$;

grant execute on function public.get_calendar_installed_subscriptions(uuid) to authenticated;
