-- 구독 카탈로그 RPC에 제공자/원본 캘린더 메타 확장

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
  category_color text,
  config jsonb,
  owner_user_id uuid,
  source_calendar_id uuid,
  source_calendar_name text,
  source_category_id uuid,
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
    catalogs.category_color,
    catalogs.config,
    catalogs.owner_user_id,
    catalogs.source_calendar_id,
    calendars.name as source_calendar_name,
    catalogs.source_category_id,
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
  category_color text,
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
    catalogs.category_color,
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
  where installs.calendar_id = target_calendar_id
    and catalogs.is_active = true
  order by
    (catalogs.status = 'source_deleted') desc,
    installs.created_at asc;
$$;

grant execute on function public.get_calendar_installed_subscriptions(uuid) to authenticated;
