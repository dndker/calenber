-- ================================================================
-- Category → Collection (breaking rename)
-- - event_categories / category_id / shared_category 전면 교체
-- - 기존 RPC는 drop 후 collection 이름으로 재생성
-- ================================================================

-- ------------------------------
-- 1) Tables / columns renames
-- ------------------------------

do $$
begin
  -- event_categories -> event_collections
  if to_regclass('public.event_categories') is not null
     and to_regclass('public.event_collections') is null then
    alter table public.event_categories rename to event_collections;
  end if;

  -- event_category_assignments -> event_collection_assignments
  if to_regclass('public.event_category_assignments') is not null
     and to_regclass('public.event_collection_assignments') is null then
    alter table public.event_category_assignments rename to event_collection_assignments;
  end if;
end$$;

-- events.category_id -> events.primary_collection_id
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

-- calendar_subscription_catalogs.source_category_id -> source_collection_id
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

-- calendar_subscription_catalogs.category_color -> collection_color
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

-- ------------------------------
-- 2) Fix FKs that referenced event_categories / category_id
-- ------------------------------

alter table public.events
drop constraint if exists events_category_id_fkey;

alter table public.events
drop constraint if exists events_primary_collection_id_fkey;

alter table public.events
add constraint events_primary_collection_id_fkey
foreign key (primary_collection_id)
references public.event_collections (id)
on delete set null;

-- event_collection_assignments FK rename/rebind
alter table public.event_collection_assignments
drop constraint if exists event_category_assignments_category_id_fkey;

alter table public.event_collection_assignments
drop constraint if exists event_collection_assignments_collection_id_fkey;

-- rename column category_id -> collection_id inside assignment table
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

alter table public.event_collection_assignments
add constraint event_collection_assignments_collection_id_fkey
foreign key (collection_id)
references public.event_collections(id)
on delete cascade;

-- keep unique(event_id, collection_id) consistent
alter table public.event_collection_assignments
drop constraint if exists event_category_assignments_event_id_category_id_key;

alter table public.event_collection_assignments
drop constraint if exists event_collection_assignments_event_id_collection_id_key;

alter table public.event_collection_assignments
add constraint event_collection_assignments_event_id_collection_id_key
unique (event_id, collection_id);

-- ------------------------------
-- 3) Subscription catalogs: source_type + constraints
-- ------------------------------
-- 레거시 CHECK가 shared_category + source_category_id 조합만 허용하므로,
-- UPDATE 전에 제약을 제거해야 shared_collection 으로 바꿀 수 있다.

alter table public.calendar_subscription_catalogs
drop constraint if exists calendar_subscription_catalogs_source_type_check;

alter table public.calendar_subscription_catalogs
drop constraint if exists calendar_subscription_catalogs_source_consistency_check;

update public.calendar_subscription_catalogs
set source_type = 'shared_collection'
where source_type = 'shared_category';

alter table public.calendar_subscription_catalogs
add constraint calendar_subscription_catalogs_source_type_check check (
  source_type in ('system_holiday', 'shared_collection', 'shared_calendar', 'custom')
);

alter table public.calendar_subscription_catalogs
add constraint calendar_subscription_catalogs_source_consistency_check check (
  (source_type = 'system_holiday' and source_calendar_id is null and source_collection_id is null)
  or (source_type = 'shared_collection' and source_calendar_id is not null and source_collection_id is not null)
  or (source_type in ('shared_calendar', 'custom'))
);

-- ------------------------------
-- 3.1) Realtime relay triggers (shared_collection)
-- ------------------------------

drop trigger if exists broadcast_subscription_event_change on public.events;
drop function if exists public.broadcast_subscription_event_change();

create or replace function public.broadcast_subscription_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_calendar_id uuid := coalesce(new.calendar_id, old.calendar_id);
  target_collection_id uuid := coalesce(new.primary_collection_id, old.primary_collection_id);
  target_event_id    uuid := coalesce(new.id, old.id);
  catalog_rec record;
  catalog_topic text;
  payload jsonb;
  event_name text;
begin
  if not exists (
    select 1
    from public.calendar_subscription_catalogs
    where source_calendar_id = target_calendar_id
      and source_collection_id = target_collection_id
      and source_type = 'shared_collection'
      and is_active = true
      and status = 'active'
  ) then
    return null;
  end if;

  event_name := case tg_op
    when 'INSERT' then 'calendar.event.created'
    when 'UPDATE' then 'calendar.event.updated'
    when 'DELETE' then 'calendar.event.deleted'
    else 'calendar.event.changed'
  end;

  payload := jsonb_build_object(
    'entity', 'subscription_event',
    'operation', lower(tg_op),
    'sourceCalendarId', target_calendar_id,
    'sourceCollectionId', target_collection_id,
    'eventId', target_event_id,
    'occurredAt', timezone('utc', now())
  );

  for catalog_rec in
    select id
    from public.calendar_subscription_catalogs
    where source_calendar_id = target_calendar_id
      and source_collection_id = target_collection_id
      and source_type = 'shared_collection'
      and is_active = true
      and status = 'active'
  loop
    catalog_topic := 'subscription:catalog:' || catalog_rec.id::text;

    perform realtime.send(
      payload || jsonb_build_object('catalogId', catalog_rec.id),
      event_name,
      catalog_topic,
      true
    );
  end loop;

  return null;
end;
$$;

create trigger broadcast_subscription_event_change
after insert or update or delete on public.events
for each row
execute function public.broadcast_subscription_event_change();

drop trigger if exists broadcast_subscription_catalog_change on public.calendar_subscription_catalogs;
drop function if exists public.broadcast_subscription_catalog_change();

create or replace function public.broadcast_subscription_catalog_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  catalog_topic text := 'subscription:catalog:' || new.id::text;
  payload jsonb;
begin
  if new.source_type != 'shared_collection' then
    return new;
  end if;

  if old.status = new.status and old.is_active = new.is_active then
    return new;
  end if;

  payload := jsonb_build_object(
    'entity', 'subscription_catalog',
    'operation', 'updated',
    'catalogId', new.id,
    'status', new.status,
    'isActive', new.is_active,
    'occurredAt', timezone('utc', now())
  );

  perform realtime.send(
    payload,
    'subscription.catalog.updated',
    catalog_topic,
    true
  );

  return new;
end;
$$;

create trigger broadcast_subscription_catalog_change
after update of status, is_active
on public.calendar_subscription_catalogs
for each row
execute function public.broadcast_subscription_catalog_change();

-- ------------------------------
-- 4) Drop legacy RPCs (category)
-- ------------------------------
-- events.category_id 검증 CHECK 가 함수를 참조하므로 함수 DROP 전에 제거한다.

alter table public.events
drop constraint if exists events_category_matches_calendar_check;

-- 테이블 rename 후에도 기존 트리거 이름은 그대로 남을 수 있다.
-- 함수 삭제 전에 참조 트리거를 먼저 끊어야 데이터는 보존하면서 의존성 오류를 피한다.
do $$
begin
  if to_regclass('public.event_categories') is not null then
    execute 'drop trigger if exists set_event_category_updated_at on public.event_categories';
  end if;

  if to_regclass('public.event_collections') is not null then
    execute 'drop trigger if exists set_event_category_updated_at on public.event_collections';
  end if;
end$$;

drop function if exists public.upsert_calendar_event_category(uuid, text);
drop function if exists public.upsert_calendar_event_category(uuid, text, jsonb);
drop function if exists public.get_calendar_event_categories(uuid);
drop function if exists public.delete_calendar_event_category(uuid);
drop function if exists public.get_event_categories_json(uuid, boolean);
drop function if exists public.replace_calendar_event_categories(uuid, uuid[]);
drop function if exists public.event_category_matches_calendar(uuid, uuid);
drop function if exists public.set_event_category_updated_at();

-- shared collection publish/events/status RPCs (old signatures)
drop function if exists public.publish_collection_as_subscription(uuid, uuid, text, text, text);
drop function if exists public.unpublish_collection_subscription(uuid, uuid);
drop function if exists public.get_shared_collection_subscription_events(uuid, uuid, timestamptz, timestamptz);
drop function if exists public.get_collection_publish_status(uuid);

-- These depend on get_event_categories_json + category_id naming
drop function if exists public.get_calendar_events_with_authors(uuid);
drop function if exists public.get_calendar_event_by_id(uuid);
drop function if exists public.get_calendar_initial_data(uuid);

-- ------------------------------
-- 5) Recreate RPCs (collection)
-- ------------------------------

create or replace function public.set_event_collection_updated_at () returns trigger language plpgsql
set search_path = '' as $$
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

drop trigger if exists set_event_collection_updated_at on public.event_collections;
create trigger set_event_collection_updated_at
before insert or update on public.event_collections
for each row execute function public.set_event_collection_updated_at();

create or replace function public.is_valid_event_collection_options (target jsonb) returns boolean language plpgsql immutable
set search_path = '' as $$
begin
  if target is null then
    return false;
  end if;

  if jsonb_typeof(target) <> 'object' then
    return false;
  end if;

  if jsonb_typeof(target -> 'visibleByDefault') <> 'boolean' then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;

alter table public.event_collections
add column if not exists options jsonb not null default '{"visibleByDefault": true}'::jsonb;

update public.event_collections
set options = '{"visibleByDefault": true}'::jsonb
where options is null;

alter table public.event_collections
drop constraint if exists event_categories_options_valid_check;
alter table public.event_collections
drop constraint if exists event_collections_options_valid_check;
alter table public.event_collections
add constraint event_collections_options_valid_check check (public.is_valid_event_collection_options(options));

-- 일정의 primary_collection 이 해당 일정 캘린더 소속 컬렉션인지 검증 (기존 event_category_matches_calendar 대체)
create or replace function public.event_collection_matches_calendar (
  target_collection_id uuid,
  target_calendar_id uuid
) returns boolean
language sql
stable
set search_path = ''
as $$
  select
    target_collection_id is null
    or exists (
      select 1
      from public.event_collections as collections
      where collections.id = target_collection_id
        and collections.calendar_id = target_calendar_id
    );
$$;

alter table public.events
drop constraint if exists events_primary_collection_matches_calendar_check;

alter table public.events
add constraint events_primary_collection_matches_calendar_check check (
  public.event_collection_matches_calendar(primary_collection_id, calendar_id)
);

drop function if exists public.upsert_calendar_event_collection(uuid, text, jsonb);
create or replace function public.upsert_calendar_event_collection (
  target_calendar_id uuid,
  target_name text,
  target_options jsonb default null
) returns uuid language plpgsql security definer
set search_path = '' as $$
declare
  trimmed_name text;
  normalized_options jsonb := jsonb_build_object('visibleByDefault', true);
  result_id uuid;
begin
  if not public.has_calendar_role(target_calendar_id, array['editor', 'manager', 'owner']) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  trimmed_name := nullif(trim(target_name), '');

  if trimmed_name is null then
    raise exception 'Collection name is required'
      using errcode = '23514';
  end if;

  if target_options is not null then
    normalized_options := normalized_options || target_options;

    if not public.is_valid_event_collection_options(normalized_options) then
      raise exception 'Invalid collection options'
        using errcode = '23514';
    end if;
  end if;

  insert into public.event_collections (
    calendar_id,
    name,
    options,
    created_by
  )
  values (
    target_calendar_id,
    trimmed_name,
    normalized_options,
    auth.uid()
  )
  on conflict (calendar_id, (lower(name)))
  do update
    set name = excluded.name,
        options = case
          when target_options is null then public.event_collections.options
          else excluded.options
        end,
        updated_at = now()
  returning id into result_id;

  return result_id;
end;
$$;

grant execute on function public.upsert_calendar_event_collection(uuid, text, jsonb) to authenticated;

drop function if exists public.get_calendar_event_collections(uuid);
create or replace function public.get_calendar_event_collections (target_calendar_id uuid) returns table (
  id uuid,
  calendar_id uuid,
  name text,
  options jsonb,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
) language plpgsql security definer
set search_path = '' as $$
begin
  if not (
    public.is_active_calendar_member(target_calendar_id)
    or public.is_calendar_publicly_viewable(target_calendar_id)
  ) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  return query
  select
    collections.id,
    collections.calendar_id,
    collections.name,
    collections.options,
    collections.created_by,
    collections.created_at,
    collections.updated_at
  from public.event_collections as collections
  where collections.calendar_id = target_calendar_id
  order by lower(collections.name) asc, collections.created_at asc;
end;
$$;

grant execute on function public.get_calendar_event_collections(uuid) to authenticated, anon;

create or replace function public.get_event_collections_json (
  target_event_id uuid,
  include_details boolean default true
) returns jsonb language sql security definer stable
set search_path = '' as $$
  select case
    when include_details is not true then '[]'::jsonb
    else coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', collections.id,
            'calendarId', collections.calendar_id,
            'name', collections.name,
            'options', collections.options,
            'createdById', collections.created_by,
            'createdAt', extract(epoch from collections.created_at) * 1000,
            'updatedAt', extract(epoch from collections.updated_at) * 1000
          )
          order by assignments.created_at asc, assignments.id asc
        )
        from public.event_collection_assignments as assignments
        join public.event_collections as collections on collections.id = assignments.collection_id
        where assignments.event_id = target_event_id
      ),
      '[]'::jsonb
    )
  end;
$$;

drop function if exists public.delete_calendar_event_collection(uuid);
create or replace function public.delete_calendar_event_collection (target_collection_id uuid) returns boolean language plpgsql security definer
set search_path = '' as $$
declare
  current_collection public.event_collections;
begin
  select *
  into current_collection
  from public.event_collections as collections
  where collections.id = target_collection_id
  for update;

  if not found then
    return false;
  end if;

  if not public.has_calendar_role(current_collection.calendar_id, array['editor', 'manager', 'owner']) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  update public.events
  set primary_collection_id = null,
      updated_at = now(),
      updated_by = coalesce(auth.uid(), updated_by, created_by)
  where primary_collection_id = target_collection_id;

  delete from public.event_collections as collections
  where collections.id = target_collection_id;

  return found;
end;
$$;

grant execute on function public.delete_calendar_event_collection(uuid) to authenticated;

drop function if exists public.replace_calendar_event_collections(uuid, uuid[]);
create or replace function public.replace_calendar_event_collections (
  target_event_id uuid,
  target_collection_ids uuid[]
) returns jsonb language plpgsql security definer
set search_path = '' as $$
declare
  current_event public.events;
  normalized_collection_ids uuid[] := coalesce(target_collection_ids, array[]::uuid[]);
  previous_collections jsonb := '[]'::jsonb;
  next_collections jsonb := '[]'::jsonb;
  next_primary_collection_id uuid;
begin
  select *
  into current_event
  from public.events as events
  where events.id = target_event_id
  for update;

  if not found then
    raise exception 'Event not found'
      using errcode = 'P0002';
  end if;

  if not public.can_update_calendar_event(
    current_event.calendar_id,
    current_event.created_by,
    current_event.is_locked
  ) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  normalized_collection_ids := array(
    select collection_id
    from (
      select distinct on (collection_id)
        collection_id,
        ordinality
      from unnest(normalized_collection_ids) with ordinality as input(collection_id, ordinality)
      where collection_id is not null
      order by collection_id, ordinality
    ) as deduped
    order by deduped.ordinality
  );

  if exists (
    select 1
    from unnest(normalized_collection_ids) as collection_id
    where not exists (
      select 1
      from public.event_collections as collections
      where collections.id = collection_id
        and collections.calendar_id = current_event.calendar_id
    )
  ) then
    raise exception 'All event collections must belong to the same calendar'
      using errcode = '23514';
  end if;

  previous_collections := public.get_event_collections_json(target_event_id, true);

  delete from public.event_collection_assignments as assignments
  where assignments.event_id = target_event_id
    and not (assignments.collection_id = any(normalized_collection_ids));

  insert into public.event_collection_assignments (
    event_id,
    collection_id,
    created_by
  )
  select
    target_event_id,
    collection_id,
    auth.uid()
  from unnest(normalized_collection_ids) as collection_id
  on conflict (event_id, collection_id)
  do nothing;

  next_primary_collection_id := normalized_collection_ids[1];

  update public.events
  set primary_collection_id = next_primary_collection_id,
      updated_at = now(),
      updated_by = coalesce(auth.uid(), updated_by, created_by)
  where id = target_event_id;

  next_collections := public.get_event_collections_json(target_event_id, true);

  if previous_collections is distinct from next_collections then
    insert into public.event_history (
      calendar_id,
      event_id,
      action,
      actor_user_id,
      summary,
      changes,
      occurred_at
    )
    values (
      current_event.calendar_id,
      target_event_id,
      'updated',
      auth.uid(),
      '컬렉션을 변경했습니다.',
      jsonb_build_array(
        public.build_event_history_change(
          'collections',
          '컬렉션',
          previous_collections,
          next_collections
        )
      ),
      now()
    );
  end if;

  return public.build_calendar_event_realtime_record(target_event_id);
end;
$$;

grant execute on function public.get_event_collections_json(uuid, boolean) to authenticated, anon;
grant execute on function public.replace_calendar_event_collections(uuid, uuid[]) to authenticated;

-- ------------------------------
-- 6) shared collection publish/events/status RPCs (updated)
-- ------------------------------

create or replace function public.publish_collection_as_subscription(
  target_calendar_id uuid,
  target_collection_id uuid,
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
begin
  if not public.has_calendar_role(target_calendar_id, array['manager', 'owner']) then
    raise exception 'permission_denied: manager or owner role required';
  end if;

  if not exists (
    select 1 from public.event_collections
    where id = target_collection_id
      and calendar_id = target_calendar_id
  ) then
    raise exception 'not_found: collection does not belong to calendar';
  end if;

  select coalesce(
    (ec.options ->> 'color'),
    'gray'
  ) into v_color
  from public.event_collections as ec
  where ec.id = target_collection_id;

  v_slug := 'subscription.shared.' || target_calendar_id::text || '.' || target_collection_id::text;

  select id into v_catalog_id
  from public.calendar_subscription_catalogs
  where source_calendar_id = target_calendar_id
    and source_collection_id = target_collection_id
  limit 1;

  if v_catalog_id is not null then
    update public.calendar_subscription_catalogs
    set
      name = p_name,
      description = p_description,
      visibility = p_visibility,
      collection_color = v_color,
      status = 'active',
      source_deleted_at = null,
      source_deleted_reason = null,
      is_active = true,
      updated_at = now()
    where id = v_catalog_id;

    return query select v_catalog_id, v_slug, false;
    return;
  end if;

  insert into public.calendar_subscription_catalogs (
    slug,
    name,
    description,
    source_type,
    visibility,
    verified,
    collection_color,
    config,
    owner_user_id,
    source_calendar_id,
    source_collection_id,
    created_by
  ) values (
    v_slug,
    p_name,
    p_description,
    'shared_collection',
    p_visibility,
    false,
    v_color,
    jsonb_build_object(
      'source_calendar_id', target_calendar_id,
      'source_collection_id', target_collection_id
    ),
    v_caller_id,
    target_calendar_id,
    target_collection_id,
    v_caller_id
  )
  returning id into v_catalog_id;

  return query select v_catalog_id, v_slug, true;
end;
$$;

grant execute on function public.publish_collection_as_subscription(uuid, uuid, text, text, text) to authenticated;

create or replace function public.unpublish_collection_subscription(
  target_calendar_id uuid,
  target_collection_id uuid
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
    and source_collection_id = target_collection_id
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
  collection_id uuid,
  collection_name text,
  collection_color text
)
language plpgsql
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

  select source_calendar_id, source_collection_id
  into v_source_calendar_id, v_source_collection_id
  from public.calendar_subscription_catalogs
  where id = p_catalog_id
    and source_type = 'shared_collection'
    and is_active = true
    and status = 'active';

  if v_source_calendar_id is null or v_source_collection_id is null then
    return;
  end if;

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
    ec.id as collection_id,
    ec.name as collection_name,
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

grant execute on function public.get_shared_collection_subscription_events(uuid, uuid, timestamptz, timestamptz) to authenticated;

create or replace function public.get_collection_publish_status(
  target_calendar_id uuid
)
returns table (
  collection_id  uuid,
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
    ) as subscriber_count
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

-- ------------------------------
-- 7) Recreate the event record RPCs using collections
-- ------------------------------

create or replace function public.build_calendar_event_realtime_record (target_event_id uuid) returns jsonb language sql security definer
set search_path = '' as $$
  select jsonb_build_object(
    'id', events.id,
    'calendar_id', events.calendar_id,
    'title', events.title,
    'content', events.content,
    'start_at', events.start_at,
    'end_at', events.end_at,
    'all_day', events.all_day,
    'timezone', events.timezone,
    'collections', public.get_event_collections_json(events.id, true),
    'primary_collection_id', events.primary_collection_id,
    'primary_collection_name', primary_collection.name,
    'primary_collection_created_by', primary_collection.created_by,
    'primary_collection_created_at', primary_collection.created_at,
    'primary_collection_updated_at', primary_collection.updated_at,
    'recurrence', events.recurrence,
    'exceptions', events.exceptions,
    'participants', public.get_event_participants_json(events.id, true),
    'status', events.status,
    'created_by', events.created_by,
    'updated_by', events.updated_by,
    'is_locked', events.is_locked,
    'created_at', events.created_at,
    'updated_at', events.updated_at,
    'creator_name', nullif(trim(creators.raw_user_meta_data ->> 'name'), '')::text,
    'creator_email', creators.email::text,
    'creator_avatar_url', nullif(trim(creators.raw_user_meta_data ->> 'avatar_url'), '')::text,
    'updater_name', nullif(trim(updaters.raw_user_meta_data ->> 'name'), '')::text,
    'updater_email', updaters.email::text,
    'updater_avatar_url', nullif(trim(updaters.raw_user_meta_data ->> 'avatar_url'), '')::text
  )
  from public.events as events
  left join public.event_collections as primary_collection on primary_collection.id = events.primary_collection_id
  left join auth.users as creators on creators.id = events.created_by
  left join auth.users as updaters on updaters.id = events.updated_by
  where events.id = target_event_id;
$$;

create or replace function public.get_calendar_events_with_authors (target_calendar_id uuid) returns table (
  id uuid,
  calendar_id uuid,
  title text,
  content jsonb,
  start_at timestamptz,
  end_at timestamptz,
  all_day boolean,
  timezone text,
  collections jsonb,
  primary_collection_id uuid,
  primary_collection_name text,
  primary_collection_created_by uuid,
  primary_collection_created_at timestamptz,
  primary_collection_updated_at timestamptz,
  recurrence jsonb,
  exceptions jsonb,
  participants jsonb,
  status public.calendar_event_status,
  created_by uuid,
  updated_by uuid,
  is_locked boolean,
  created_at timestamptz,
  updated_at timestamptz,
  creator_name text,
  creator_email text,
  creator_avatar_url text,
  updater_name text,
  updater_email text,
  updater_avatar_url text
) language plpgsql security definer
set search_path = '' as $$
declare
  include_participants boolean;
begin
  if not (
    public.is_active_calendar_member(target_calendar_id)
    or public.is_calendar_publicly_viewable(target_calendar_id)
  ) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  include_participants := public.is_active_calendar_member(target_calendar_id);

  return query
  select
    events.id,
    events.calendar_id,
    events.title,
    events.content,
    events.start_at,
    events.end_at,
    events.all_day,
    events.timezone,
    public.get_event_collections_json(events.id, true),
    events.primary_collection_id,
    primary_collection.name,
    primary_collection.created_by,
    primary_collection.created_at,
    primary_collection.updated_at,
    events.recurrence,
    events.exceptions,
    public.get_event_participants_json(events.id, include_participants),
    events.status,
    events.created_by,
    events.updated_by,
    events.is_locked,
    events.created_at,
    events.updated_at,
    nullif(trim(creators.raw_user_meta_data ->> 'name'), '')::text,
    creators.email::text,
    nullif(trim(creators.raw_user_meta_data ->> 'avatar_url'), '')::text,
    nullif(trim(updaters.raw_user_meta_data ->> 'name'), '')::text,
    updaters.email::text,
    nullif(trim(updaters.raw_user_meta_data ->> 'avatar_url'), '')::text
  from public.events as events
  left join public.event_collections as primary_collection on primary_collection.id = events.primary_collection_id
  left join auth.users as creators on creators.id = events.created_by
  left join auth.users as updaters on updaters.id = events.updated_by
  where events.calendar_id = target_calendar_id
  order by events.start_at asc, events.created_at asc;
end;
$$;

grant execute on function public.get_calendar_events_with_authors(uuid) to authenticated, anon;

create or replace function public.get_calendar_event_by_id (target_event_id uuid) returns table (
  id uuid,
  calendar_id uuid,
  title text,
  content jsonb,
  start_at timestamptz,
  end_at timestamptz,
  all_day boolean,
  timezone text,
  collections jsonb,
  primary_collection_id uuid,
  primary_collection_name text,
  primary_collection_created_by uuid,
  primary_collection_created_at timestamptz,
  primary_collection_updated_at timestamptz,
  recurrence jsonb,
  exceptions jsonb,
  participants jsonb,
  status public.calendar_event_status,
  created_by uuid,
  updated_by uuid,
  is_locked boolean,
  created_at timestamptz,
  updated_at timestamptz,
  creator_name text,
  creator_email text,
  creator_avatar_url text,
  updater_name text,
  updater_email text,
  updater_avatar_url text
) language plpgsql security definer
set search_path = '' as $$
declare
  resolved_calendar_id uuid;
  include_participants boolean;
begin
  select events.calendar_id
  into resolved_calendar_id
  from public.events as events
  where events.id = target_event_id;

  if not (
    public.is_active_calendar_member(resolved_calendar_id)
    or public.is_calendar_publicly_viewable(resolved_calendar_id)
  ) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  include_participants := public.is_active_calendar_member(resolved_calendar_id);

  return query
  select
    events.id,
    events.calendar_id,
    events.title,
    events.content,
    events.start_at,
    events.end_at,
    events.all_day,
    events.timezone,
    public.get_event_collections_json(events.id, true),
    events.primary_collection_id,
    primary_collection.name,
    primary_collection.created_by,
    primary_collection.created_at,
    primary_collection.updated_at,
    events.recurrence,
    events.exceptions,
    public.get_event_participants_json(events.id, include_participants),
    events.status,
    events.created_by,
    events.updated_by,
    events.is_locked,
    events.created_at,
    events.updated_at,
    nullif(trim(creators.raw_user_meta_data ->> 'name'), '')::text,
    creators.email::text,
    nullif(trim(creators.raw_user_meta_data ->> 'avatar_url'), '')::text,
    nullif(trim(updaters.raw_user_meta_data ->> 'name'), '')::text,
    updaters.email::text,
    nullif(trim(updaters.raw_user_meta_data ->> 'avatar_url'), '')::text
  from public.events as events
  left join public.event_collections as primary_collection on primary_collection.id = events.primary_collection_id
  left join auth.users as creators on creators.id = events.created_by
  left join auth.users as updaters on updaters.id = events.updated_by
  where events.id = target_event_id;
end;
$$;

grant execute on function public.get_calendar_event_by_id(uuid) to authenticated, anon;

create or replace function public.get_calendar_initial_data(
  target_calendar_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  has_access boolean;
  membership_row public.calendar_members;
begin
  has_access := public.is_active_calendar_member(target_calendar_id)
    or public.is_calendar_publicly_viewable(target_calendar_id);

  if auth.uid() is not null then
    select *
    into membership_row
    from public.calendar_members as members
    where members.calendar_id = target_calendar_id
      and members.user_id = auth.uid()
    limit 1;
  end if;

  return jsonb_build_object(
    'calendar',
    case
      when has_access then (
        select jsonb_build_object(
          'id', calendars.id,
          'name', calendars.name,
          'avatarUrl', calendars.avatar_url,
          'accessMode', calendars.access_mode,
          'eventLayout', calendars.event_layout,
          'updatedAt', calendars.updated_at,
          'createdAt', calendars.created_at
        )
        from public.calendars as calendars
        where calendars.id = target_calendar_id
      )
      else null
    end,
    'membership',
    jsonb_build_object(
      'isMember', coalesce(membership_row.status = 'active', false),
      'role', membership_row.role,
      'status', membership_row.status
    ),
    'myCalendars',
    case
      when auth.uid() is null then '[]'::jsonb
      else coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', calendars.id,
              'name', calendars.name,
              'avatarUrl', calendars.avatar_url,
              'accessMode', calendars.access_mode,
              'eventLayout', calendars.event_layout,
              'updatedAt', calendars.updated_at,
              'createdAt', calendars.created_at,
              'role', members.role
            )
            order by calendars.updated_at desc, calendars.created_at asc
          )
          from public.calendars as calendars
          join public.calendar_members as members
            on members.calendar_id = calendars.id
          where members.user_id = auth.uid()
            and members.status = 'active'
        ),
        '[]'::jsonb
      )
    end,
    'eventCollections',
    case
      when has_access then coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', collections.id,
              'calendarId', collections.calendar_id,
              'name', collections.name,
              'options', collections.options,
              'createdById', collections.created_by,
              'createdAt', collections.created_at,
              'updatedAt', collections.updated_at
            )
            order by lower(collections.name) asc, collections.created_at asc
          )
          from public.event_collections as collections
          where collections.calendar_id = target_calendar_id
        ),
        '[]'::jsonb
      )
      else '[]'::jsonb
    end,
    'events',
    case
      when has_access then coalesce(
        (
          select jsonb_agg(to_jsonb(events))
          from public.get_calendar_events_with_authors(target_calendar_id) as events
        ),
        '[]'::jsonb
      )
      else '[]'::jsonb
    end
  );
end;
$$;

grant execute on function public.get_calendar_initial_data(uuid) to authenticated, anon;
