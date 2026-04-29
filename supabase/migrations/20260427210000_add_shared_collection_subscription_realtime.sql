-- ================================================================
-- 컬렉션 구독 실시간 동기화
-- 원본 카테고리 이벤트가 변경되면 해당 카탈로그의 구독자 채널로 broadcast
-- 토픽 형식: subscription:catalog:<catalog_id>
-- ================================================================

-- ----------------------------------------------------------------
-- 1) 구독 카탈로그 토픽 접근 권한 확인
--    구독이 설치된 캘린더의 멤버만 접근 가능
-- ----------------------------------------------------------------
create or replace function public.get_catalog_id_from_subscription_topic(
  target_topic text
)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  prefix text := 'subscription:catalog:';
  raw_id text;
begin
  if not starts_with(target_topic, prefix) then
    return null;
  end if;

  raw_id := substring(target_topic from length(prefix) + 1);

  begin
    return raw_id::uuid;
  exception
    when others then
      return null;
  end;
end;
$$;

create or replace function public.can_access_subscription_catalog_topic(
  target_topic text
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  with parsed as (
    select public.get_catalog_id_from_subscription_topic(target_topic) as catalog_id
  )
  select exists (
    select 1
    from parsed
    join public.calendar_subscription_installs as i
      on i.subscription_catalog_id = parsed.catalog_id
    where parsed.catalog_id is not null
      and public.is_active_calendar_member(i.calendar_id)
  );
$$;

-- ----------------------------------------------------------------
-- 2) 구독 카탈로그 채널 RLS 정책
-- ----------------------------------------------------------------

-- 구독 설치자만 읽기 가능
drop policy if exists "subscription catalog realtime read" on realtime.messages;
create policy "subscription catalog realtime read"
on realtime.messages
for select
to authenticated
using (
  (
    -- 기존 calendar workspace 채널 정책
    realtime.messages.extension in ('broadcast', 'presence')
    and public.can_access_calendar_workspace_topic((select realtime.topic()))
  )
  or
  (
    -- 구독 카탈로그 채널 정책
    realtime.messages.extension = 'broadcast'
    and public.can_access_subscription_catalog_topic((select realtime.topic()))
  )
);

-- 서버(security definer 함수)만 쓰기. 클라이언트 직접 발행 불필요.
-- 기존 calendar workspace write 정책은 유지하고, 구독 채널은 서버 전용.

-- ----------------------------------------------------------------
-- 3) 원본 이벤트 변경 시 구독 카탈로그 채널로 relay broadcast
-- ----------------------------------------------------------------
create or replace function public.broadcast_subscription_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_calendar_id uuid := coalesce(new.calendar_id, old.calendar_id);
  target_category_id uuid := coalesce(new.category_id, old.category_id);
  target_event_id    uuid := coalesce(new.id, old.id);
  catalog_rec record;
  catalog_topic text;
  payload jsonb;
  event_name text;
begin
  -- 이 이벤트가 shared_category 구독의 원본 카테고리에 속하는지 확인
  -- 없으면 바로 리턴 (불필요한 loop 방지)
  if not exists (
    select 1
    from public.calendar_subscription_catalogs
    where source_calendar_id = target_calendar_id
      and source_category_id = target_category_id
      and source_type = 'shared_category'
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
    'sourceCategoryId', target_category_id,
    'eventId', target_event_id,
    'occurredAt', timezone('utc', now())
  );

  -- 해당 카테고리를 소스로 가진 모든 카탈로그에 broadcast
  for catalog_rec in
    select id
    from public.calendar_subscription_catalogs
    where source_calendar_id = target_calendar_id
      and source_category_id = target_category_id
      and source_type = 'shared_category'
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

drop trigger if exists broadcast_subscription_event_change on public.events;
create trigger broadcast_subscription_event_change
after insert or update or delete on public.events
for each row
execute function public.broadcast_subscription_event_change();

-- ----------------------------------------------------------------
-- 4) 카탈로그 상태 변경 시 구독자에게 알림
--    (공유 비활성화, 원본 삭제 등)
-- ----------------------------------------------------------------
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
  -- source_type이 shared_category이고 status 또는 is_active가 바뀐 경우만 처리
  if new.source_type != 'shared_category' then
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

drop trigger if exists broadcast_subscription_catalog_change on public.calendar_subscription_catalogs;
create trigger broadcast_subscription_catalog_change
after update of status, is_active
on public.calendar_subscription_catalogs
for each row
execute function public.broadcast_subscription_catalog_change();
