-- get_collection_publish_status에 description 컬럼 추가
-- 다이얼로그가 기존 발행 카탈로그의 description을 초기값으로 채우기 위해 필요.

drop function if exists public.get_collection_publish_status(uuid);

create or replace function public.get_collection_publish_status(
  target_calendar_id uuid
)
returns table (
  collection_id    uuid,
  catalog_id       uuid,
  is_published     boolean,
  visibility       text,
  status           text,
  subscriber_count bigint,
  description      text
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    ec.id as collection_id,
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
    ) as subscriber_count,
    coalesce(cat.description, '') as description
  from public.event_collections as ec
  left join public.calendar_subscription_catalogs as cat
    on cat.source_calendar_id = target_calendar_id
   and cat.source_collection_id = ec.id
   and cat.source_type = 'shared_collection'
  where ec.calendar_id = target_calendar_id
    and public.has_calendar_role(target_calendar_id, array['manager', 'owner'])
  order by ec.created_at asc;
$$;

grant execute on function public.get_collection_publish_status(uuid) to authenticated;
