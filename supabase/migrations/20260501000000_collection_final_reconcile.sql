-- ================================================================
-- Collection final reconcile (idempotent)
--
-- 개발/실서버의 마이그레이션 적용 이력이 서로 달라도 최종 DB shape가
-- collection 기준으로 수렴하도록 보정한다.
-- - 데이터 컬럼/테이블은 삭제하지 않고 rename만 사용한다.
-- - 레거시 trigger/function 의존성은 trigger를 먼저 제거한 뒤 function을 제거한다.
-- - 앱이 기대하는 shared_collection RPC 최종 시그니처를 보장한다.
-- ================================================================

-- ------------------------------
-- 1) 레거시 category 명칭을 collection 명칭으로 보존 rename
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
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'event_collection_assignments'
      and column_name = 'category_id'
  ) and not exists (
    select 1
    from information_schema.columns
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
-- 2) 레거시 트리거/함수 의존성 정리
-- ------------------------------

do $$
begin
  if to_regclass('public.event_categories') is not null then
    execute 'drop trigger if exists set_event_category_updated_at on public.event_categories';
    execute 'drop trigger if exists broadcast_calendar_event_category_change on public.event_categories';
    execute 'drop trigger if exists broadcast_calendar_event_collection_change on public.event_categories';
  end if;

  if to_regclass('public.event_collections') is not null then
    execute 'drop trigger if exists set_event_category_updated_at on public.event_collections';
    execute 'drop trigger if exists broadcast_calendar_event_category_change on public.event_collections';
    execute 'drop trigger if exists broadcast_calendar_event_collection_change on public.event_collections';
  end if;
end$$;

drop function if exists public.set_event_category_updated_at();
drop function if exists public.broadcast_calendar_event_category_change();
drop function if exists public.build_calendar_event_category_realtime_record(uuid);

-- ------------------------------
-- 3) collection updated_at trigger 보장
-- ------------------------------

create or replace function public.set_event_collection_updated_at () returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at = coalesce(new.created_at, now());
    new.updated_at = coalesce(new.updated_at, new.created_at, now());
    new.created_by = coalesce(new.created_by, auth.uid());
    return new;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.event_collections') is not null then
    execute 'drop trigger if exists set_event_collection_updated_at on public.event_collections';
    execute '
      create trigger set_event_collection_updated_at
      before insert or update on public.event_collections
      for each row execute function public.set_event_collection_updated_at()
    ';
  end if;
end$$;

-- ------------------------------
-- 4) collection realtime trigger 보장
-- ------------------------------

create or replace function public.build_calendar_event_collection_realtime_record (
  target_collection_id uuid
) returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', collections.id,
    'calendar_id', collections.calendar_id,
    'name', collections.name,
    'options', collections.options,
    'created_by', collections.created_by,
    'created_at', collections.created_at,
    'updated_at', collections.updated_at
  )
  from public.event_collections as collections
  where collections.id = target_collection_id;
$$;

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
    execute 'drop trigger if exists broadcast_calendar_event_collection_change on public.event_collections';
    execute '
      create trigger broadcast_calendar_event_collection_change
      after insert or update or delete on public.event_collections
      for each row execute function public.broadcast_calendar_event_collection_change()
    ';
  end if;
end$$;

-- ------------------------------
-- 5) shared_collection 이벤트 RPC 최종 형태 보장
-- ------------------------------

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
