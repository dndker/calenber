-- ================================================================
-- Category → Collection 보완 마이그레이션 (additive / idempotent)
--
-- • 기존 마이그레이션 파일은 수정하지 않는다.
-- • 동일 저장소에서 `20260428180000_rename_category_to_collection.sql` 이후에 실행된다.
-- • 이미 28180000이 적용된 DB에서는 아래 DO 블록이 대부분 no-op이다.
-- • 워크스페이스 실시간: `build_calendar_event_collection_realtime_record`가
--   `event_collections`를 우선 조회하되, 레거시 테이블이 남은 DB도 처리한다.
--   이전 `event_categories` 전용 함수는 테이블 rename 이후 런타임 오류가 나므로
--   `event_collections`(및 레거시 테이블이 남은 경우 `event_categories`)를
--   모두 처리하도록 교체한다.
-- • 페이로드 키와 채널명도 collection 기준(event_collection / collectionId /
--   calendar.event-collection.*)으로 통일한다.
-- ================================================================

-- ------------------------------
-- 1) 테이블·컬럼 rename (28180000과 동일 조건, 중복 적용 안전)
-- ------------------------------

do $$
begin
  if to_regclass('public.event_categories') is not null
     and to_regclass('public.event_collections') is null then
    alter table public.event_categories rename to event_collections;
  end if;

  if to_regclass('public.event_category_assignments') is not null
     and to_regclass('public.event_collection_assignments') is null then
    alter table public.event_category_assignments rename to event_collection_assignments;
  end if;
end$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'events'
      and column_name = 'category_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'events'
      and column_name = 'primary_collection_id'
  ) then
    alter table public.events rename column category_id to primary_collection_id;
  end if;
end$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'calendar_subscription_catalogs'
      and column_name = 'source_category_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'calendar_subscription_catalogs'
      and column_name = 'source_collection_id'
  ) then
    alter table public.calendar_subscription_catalogs
      rename column source_category_id to source_collection_id;
  end if;
end$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'calendar_subscription_catalogs'
      and column_name = 'category_color'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'calendar_subscription_catalogs'
      and column_name = 'collection_color'
  ) then
    alter table public.calendar_subscription_catalogs
      rename column category_color to collection_color;
  end if;
end$$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'event_collection_assignments'
      and column_name = 'category_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'event_collection_assignments'
      and column_name = 'collection_id'
  ) then
    alter table public.event_collection_assignments
      rename column category_id to collection_id;
  end if;
end$$;

update public.calendar_subscription_catalogs
set source_type = 'shared_collection'
where source_type = 'shared_category';

-- ------------------------------
-- 2) 워크스페이스 · 컬렉션/카테고리 변경 브로드캐스트 (테이블명 무관 동작)
-- ------------------------------

create or replace function public.build_calendar_event_collection_realtime_record (
  target_collection_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if to_regclass('public.event_collections') is not null then
    select jsonb_build_object(
      'id', c.id,
      'calendar_id', c.calendar_id,
      'name', c.name,
      'options', c.options,
      'created_by', c.created_by,
      'created_at', c.created_at,
      'updated_at', c.updated_at
    )
    into result
    from public.event_collections as c
    where c.id = target_collection_id;

    return result;
  end if;

  if to_regclass('public.event_categories') is not null then
    select jsonb_build_object(
      'id', c.id,
      'calendar_id', c.calendar_id,
      'name', c.name,
      'options', c.options,
      'created_by', c.created_by,
      'created_at', c.created_at,
      'updated_at', c.updated_at
    )
    into result
    from public.event_categories as c
    where c.id = target_collection_id;

    return result;
  end if;

  return null;
end;
$$;

-- 트리거는 테이블 rename 후에도 이름이 남을 수 있어 양쪽에서 제거 후 재생성한다.
-- DROP TRIGGER는 대상 테이블이 없으면 IF EXISTS여도 실패하므로 테이블 존재를 먼저 확인한다.
do $$
begin
  if to_regclass('public.event_categories') is not null then
    execute 'drop trigger if exists broadcast_calendar_event_category_change on public.event_categories';
    execute 'drop trigger if exists broadcast_calendar_event_collection_change on public.event_categories';
  end if;

  if to_regclass('public.event_collections') is not null then
    execute 'drop trigger if exists broadcast_calendar_event_category_change on public.event_collections';
    execute 'drop trigger if exists broadcast_calendar_event_collection_change on public.event_collections';
  end if;
end$$;

drop function if exists public.broadcast_calendar_event_category_change();
drop function if exists public.build_calendar_event_category_realtime_record(uuid);

create or replace function public.broadcast_calendar_event_collection_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_calendar_id uuid := coalesce(new.calendar_id, old.calendar_id);
  target_collection_id uuid := coalesce(new.id, old.id);
  target_topic text := public.get_calendar_workspace_topic(target_calendar_id);
  target_is_private boolean := public.is_calendar_workspace_topic_private(target_calendar_id);
  target_event_name text;
  target_payload jsonb;
begin
  target_event_name := case tg_op
    when 'INSERT' then 'calendar.event-collection.created'
    when 'UPDATE' then 'calendar.event-collection.updated'
    when 'DELETE' then 'calendar.event-collection.deleted'
    else 'calendar.event-collection.changed'
  end;

  target_payload := jsonb_build_object(
    'entity', 'event_collection',
    'operation', lower(tg_op),
    'calendarId', target_calendar_id,
    'collectionId', target_collection_id,
    'occurredAt', timezone('utc', now())
  );

  if tg_op = 'DELETE' then
    target_payload := target_payload || jsonb_build_object(
      'record',
      jsonb_build_object(
        'id', old.id,
        'calendar_id', old.calendar_id
      )
    );
  else
    target_payload := target_payload || jsonb_build_object(
      'record',
      public.build_calendar_event_collection_realtime_record(target_collection_id)
    );
  end if;

  perform realtime.send(
    target_payload,
    target_event_name,
    target_topic,
    target_is_private
  );

  return null;
end;
$$;

do $$
begin
  if to_regclass('public.event_collections') is not null then
    create trigger broadcast_calendar_event_collection_change
    after insert or update or delete on public.event_collections
    for each row
    execute function public.broadcast_calendar_event_collection_change();
  elsif to_regclass('public.event_categories') is not null then
    create trigger broadcast_calendar_event_collection_change
    after insert or update or delete on public.event_categories
    for each row
    execute function public.broadcast_calendar_event_collection_change();
  end if;
end$$;

-- ------------------------------
-- 3) 인덱스 이름 정리 (테이블 rename 후에도 인덱스 이름은 종종 레거시로 남음)
-- ------------------------------

do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'i'
      and c.relname = 'event_categories_pkey'
  ) then
    alter index public.event_categories_pkey rename to event_collections_pkey;
  end if;
exception
  when duplicate_object then null;
end$$;

do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'i'
      and c.relname = 'event_categories_calendar_name_uidx'
  ) then
    alter index public.event_categories_calendar_name_uidx
      rename to event_collections_calendar_name_uidx;
  end if;
exception
  when duplicate_object then null;
end$$;

-- ------------------------------
-- 4) Out-of-order push 보정: shared_collection 이벤트 RPC 최신 형태 보장
-- ------------------------------
-- 일부 원격 DB는 20260429120000/20260430100000/20260430110000이 먼저 적용되고
-- 20260428180000이 나중에 include-all로 들어갈 수 있다. 이 경우 28180000의
-- 예전 RPC 정의가 최신 반환 타입을 되돌리므로, 마지막 보정 마이그레이션에서
-- 현재 앱이 기대하는 최종 시그니처를 다시 만든다.

drop function if exists public.get_shared_collection_subscription_events(uuid, uuid, timestamptz, timestamptz);

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

revoke all on function public.get_shared_collection_subscription_events(uuid, uuid, timestamptz, timestamptz)
from public;

grant execute on function public.get_shared_collection_subscription_events(uuid, uuid, timestamptz, timestamptz)
to authenticated;

do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'i'
      and c.relname = 'event_categories_calendar_updated_idx'
  ) then
    alter index public.event_categories_calendar_updated_idx
      rename to event_collections_calendar_updated_idx;
  end if;
exception
  when duplicate_object then null;
end$$;

do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'i'
      and c.relname = 'event_category_assignments_event_created_idx'
  ) then
    alter index public.event_category_assignments_event_created_idx
      rename to event_collection_assignments_event_created_idx;
  end if;
exception
  when duplicate_object then null;
end$$;

do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'i'
      and c.relname = 'event_category_assignments_category_created_idx'
  ) then
    alter index public.event_category_assignments_category_created_idx
      rename to event_collection_assignments_collection_created_idx;
  end if;
exception
  when duplicate_object then null;
end$$;
