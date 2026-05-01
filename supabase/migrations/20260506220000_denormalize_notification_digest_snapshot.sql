-- notification_digests에 대표 알림 스냅샷을 저장해
-- 알림 목록 조회와 realtime 반영 시 notifications 조인을 제거한다.

alter table public.notification_digests
add column if not exists notification_type text,
add column if not exists entity_type text,
add column if not exists entity_id text,
add column if not exists calendar_id uuid references public.calendars(id) on delete cascade,
add column if not exists metadata jsonb not null default '{}'::jsonb,
add column if not exists is_read boolean not null default false,
add column if not exists created_at timestamptz;

update public.notification_digests as digests
set
  notification_type = notifications.notification_type,
  entity_type = notifications.entity_type,
  entity_id = notifications.entity_id,
  calendar_id = notifications.calendar_id,
  metadata = coalesce(notifications.metadata, '{}'::jsonb),
  is_read = digests.unread_count = 0,
  created_at = coalesce(notifications.created_at, digests.last_occurred_at)
from public.notifications as notifications
where notifications.id = digests.latest_notification_id
  and (
    digests.notification_type is null
    or digests.entity_type is null
    or digests.entity_id is null
    or digests.created_at is null
  );

drop function if exists public.get_notifications(
  p_limit int,
  p_cursor timestamptz,
  p_unread_only boolean
);

create or replace function public.get_notifications(
  p_limit       int           default 30,
  p_cursor      timestamptz   default null,
  p_unread_only boolean       default false
)
returns table (
  digest_key          text,
  count               int,
  unread_count        int,
  actor_ids           uuid[],
  last_occurred_at    timestamptz,
  notification_id     uuid,
  notification_type   text,
  entity_type         text,
  entity_id           text,
  calendar_id         uuid,
  metadata            jsonb,
  is_read             boolean,
  created_at          timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    nd.digest_key,
    nd.count,
    nd.unread_count,
    nd.actor_ids,
    nd.last_occurred_at,
    nd.latest_notification_id as notification_id,
    nd.notification_type,
    nd.entity_type,
    nd.entity_id,
    nd.calendar_id,
    nd.metadata,
    nd.is_read,
    coalesce(nd.created_at, nd.last_occurred_at) as created_at
  from public.notification_digests as nd
  where nd.recipient_id = auth.uid()
    and nd.latest_notification_id is not null
    and nd.notification_type is not null
    and nd.entity_type is not null
    and nd.entity_id is not null
    and (p_unread_only = false or nd.unread_count > 0)
    and (p_cursor is null or nd.last_occurred_at < p_cursor)
  order by nd.last_occurred_at desc
  limit p_limit
$$;

grant execute on function public.get_notifications to authenticated;

drop function if exists public.create_notification(
  p_recipient_id uuid,
  p_actor_id uuid,
  p_notification_type text,
  p_entity_type text,
  p_entity_id text,
  p_calendar_id uuid,
  p_metadata jsonb
);

create or replace function public.create_notification(
  p_recipient_id      uuid,
  p_actor_id          uuid,
  p_notification_type text,
  p_entity_type       text,
  p_entity_id         text,
  p_calendar_id       uuid    default null,
  p_metadata          jsonb   default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_digest_key  text;
  v_notif_id    uuid;
  v_actor_ids   uuid[];
  v_created_at  timestamptz := now();
begin
  v_digest_key := p_notification_type || ':' || p_entity_type || ':' || p_entity_id;

  insert into public.notifications (
    recipient_id, actor_id, notification_type,
    entity_type, entity_id, calendar_id,
    metadata, digest_key, created_at
  )
  values (
    p_recipient_id, p_actor_id, p_notification_type,
    p_entity_type, p_entity_id, p_calendar_id,
    p_metadata, v_digest_key, v_created_at
  )
  returning id into v_notif_id;

  select coalesce(actor_ids, '{}') into v_actor_ids
  from public.notification_digests
  where recipient_id = p_recipient_id
    and digest_key = v_digest_key;

  if p_actor_id is not null and not (p_actor_id = any(coalesce(v_actor_ids, '{}'))) then
    v_actor_ids := array_prepend(p_actor_id, coalesce(v_actor_ids, '{}'));
    if array_length(v_actor_ids, 1) > 5 then
      v_actor_ids := v_actor_ids[1:5];
    end if;
  end if;

  insert into public.notification_digests (
    recipient_id,
    digest_key,
    latest_notification_id,
    count,
    actor_ids,
    unread_count,
    last_occurred_at,
    notification_type,
    entity_type,
    entity_id,
    calendar_id,
    metadata,
    is_read,
    created_at
  )
  values (
    p_recipient_id,
    v_digest_key,
    v_notif_id,
    1,
    coalesce(v_actor_ids, '{}'),
    1,
    v_created_at,
    p_notification_type,
    p_entity_type,
    p_entity_id,
    p_calendar_id,
    coalesce(p_metadata, '{}'::jsonb),
    false,
    v_created_at
  )
  on conflict (recipient_id, digest_key) do update set
    latest_notification_id = v_notif_id,
    count                  = notification_digests.count + 1,
    actor_ids              = v_actor_ids,
    unread_count           = notification_digests.unread_count + 1,
    last_occurred_at       = v_created_at,
    notification_type      = p_notification_type,
    entity_type            = p_entity_type,
    entity_id              = p_entity_id,
    calendar_id            = p_calendar_id,
    metadata               = coalesce(p_metadata, '{}'::jsonb),
    is_read                = false,
    created_at             = v_created_at,
    updated_at             = v_created_at;

  return v_notif_id;
end;
$$;

revoke execute on function public.create_notification from anon, authenticated;
