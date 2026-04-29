-- ================================================================
-- 두 가지 회귀 수정
--
-- 1) broadcast_subscription_event_change 트리거 함수가
--    레거시 category_id / source_category_id / shared_category 를
--    참조한 채 events 테이블에 살아있어 INSERT 시 42703 에러 발생.
--    → collection 기준 최종 버전으로 교체.
--
-- 2) get_calendar_initial_data 가 20260428180000 에서 재정의될 때
--    eventFieldSettings / layoutOptions 가 누락된 채 덮어씌워짐.
--    → 두 필드 포함한 최종 버전으로 교체.
-- ================================================================

-- ----------------------------------------------------------------
-- 1) broadcast_subscription_event_change 교체
-- ----------------------------------------------------------------

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

-- ----------------------------------------------------------------
-- 2) broadcast_subscription_catalog_change 교체
--    (shared_category → shared_collection 체크 교정)
-- ----------------------------------------------------------------

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

-- ----------------------------------------------------------------
-- 3) get_calendar_initial_data — eventFieldSettings / layoutOptions 복원
-- ----------------------------------------------------------------

drop function if exists public.get_calendar_initial_data(uuid);

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
          'eventFieldSettings', calendars.event_field_settings,
          'layoutOptions', calendars.layout_options,
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
              'eventFieldSettings', calendars.event_field_settings,
              'layoutOptions', calendars.layout_options,
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
