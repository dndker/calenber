create table if not exists public.notification_delivery_queue (
  id                uuid primary key default gen_random_uuid(),
  notification_id   uuid not null unique references public.notifications(id) on delete cascade,
  recipient_id      uuid not null references auth.users(id) on delete cascade,
  channels          text[] not null default '{}'::text[],
  status            text not null default 'pending'
                    check (status in ('pending', 'processing', 'sent', 'failed', 'noop')),
  attempt_count     int not null default 0,
  last_attempted_at timestamptz,
  processed_at      timestamptz,
  locked_at         timestamptz,
  last_error        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists notification_delivery_queue_status_created_idx
  on public.notification_delivery_queue(status, created_at asc);

create index if not exists notification_delivery_queue_recipient_idx
  on public.notification_delivery_queue(recipient_id, created_at desc);

alter table public.notification_delivery_queue enable row level security;

create policy "users can read own notification delivery queue"
on public.notification_delivery_queue
for select
using (auth.uid() = recipient_id);

create or replace function public.resolve_notification_delivery_channels(
  p_recipient_id uuid,
  p_notification_type text
)
returns text[]
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_push_enabled boolean := true;
  v_email_enabled boolean := false;
  v_email_digest text := 'realtime';
  v_type_enabled boolean := true;
  v_has_push_subscription boolean := false;
  v_channels text[] := array[]::text[];
begin
  select
    preferences.push_enabled,
    preferences.email_enabled,
    preferences.email_digest,
    coalesce((preferences.type_settings ->> p_notification_type)::boolean, true)
  into
    v_push_enabled,
    v_email_enabled,
    v_email_digest,
    v_type_enabled
  from public.user_notification_preferences as preferences
  where preferences.user_id = p_recipient_id;

  if not coalesce(v_type_enabled, true) then
    return array[]::text[];
  end if;

  select exists(
    select 1
    from public.push_subscriptions as subscriptions
    where subscriptions.user_id = p_recipient_id
  )
  into v_has_push_subscription;

  if coalesce(v_push_enabled, true) and v_has_push_subscription then
    v_channels := array_append(v_channels, 'push');
  end if;

  if coalesce(v_email_enabled, false) and coalesce(v_email_digest, 'realtime') = 'realtime' then
    v_channels := array_append(v_channels, 'email');
  end if;

  return v_channels;
end;
$$;

revoke execute on function public.resolve_notification_delivery_channels(uuid, text)
from public, anon, authenticated;

create or replace function public.enqueue_notification_delivery(
  p_notification_id uuid,
  p_recipient_id uuid,
  p_notification_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_channels text[] := public.resolve_notification_delivery_channels(
    p_recipient_id,
    p_notification_type
  );
  v_status text := case
    when coalesce(array_length(v_channels, 1), 0) = 0 then 'noop'
    else 'pending'
  end;
  v_job_id uuid;
begin
  insert into public.notification_delivery_queue (
    notification_id,
    recipient_id,
    channels,
    status,
    attempt_count,
    last_attempted_at,
    processed_at,
    locked_at,
    last_error,
    created_at,
    updated_at
  )
  values (
    p_notification_id,
    p_recipient_id,
    v_channels,
    v_status,
    0,
    null,
    case when v_status = 'noop' then now() else null end,
    null,
    null,
    now(),
    now()
  )
  on conflict (notification_id) do update set
    channels = excluded.channels,
    status = excluded.status,
    processed_at = excluded.processed_at,
    locked_at = null,
    last_error = null,
    updated_at = now()
  returning id into v_job_id;

  return v_job_id;
end;
$$;

revoke execute on function public.enqueue_notification_delivery(uuid, uuid, text)
from public, anon, authenticated;

create or replace function public.claim_notification_delivery_jobs(
  p_limit int default 20
)
returns table (
  id uuid,
  notification_id uuid,
  recipient_id uuid,
  channels text[]
)
language sql
security definer
set search_path = ''
as $$
  with next_jobs as (
    select queue.id
    from public.notification_delivery_queue as queue
    where queue.status in ('pending', 'failed')
      and coalesce(array_length(queue.channels, 1), 0) > 0
      and queue.attempt_count < 5
      and (
        queue.locked_at is null
        or queue.locked_at < now() - interval '2 minutes'
      )
    order by queue.created_at asc
    limit greatest(coalesce(p_limit, 20), 1)
    for update skip locked
  )
  update public.notification_delivery_queue as queue
  set
    status = 'processing',
    attempt_count = queue.attempt_count + 1,
    last_attempted_at = now(),
    locked_at = now(),
    updated_at = now()
  from next_jobs
  where queue.id = next_jobs.id
  returning
    queue.id,
    queue.notification_id,
    queue.recipient_id,
    queue.channels;
$$;

revoke execute on function public.claim_notification_delivery_jobs(int)
from public, anon, authenticated;

create or replace function public.complete_notification_delivery_job(
  p_job_id uuid,
  p_success boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notification_delivery_queue
  set
    status = case when p_success then 'sent' else 'failed' end,
    processed_at = case when p_success then now() else null end,
    locked_at = null,
    last_error = case when p_success then null else left(p_error, 2000) end,
    updated_at = now()
  where id = p_job_id;
end;
$$;

revoke execute on function public.complete_notification_delivery_job(uuid, boolean, text)
from public, anon, authenticated;

drop function if exists public.mark_notifications_read(
  p_digest_keys text[]
);

create or replace function public.mark_notifications_read(
  p_digest_keys text[] default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications
  set is_read = true,
      read_at = now()
  where recipient_id = auth.uid()
    and is_read = false
    and (p_digest_keys is null or digest_key = any(p_digest_keys));

  update public.notification_digests
  set unread_count = 0,
      is_read = true,
      updated_at = now()
  where recipient_id = auth.uid()
    and unread_count > 0
    and (p_digest_keys is null or digest_key = any(p_digest_keys));
end;
$$;

grant execute on function public.mark_notifications_read to authenticated;

update public.notification_digests
set is_read = unread_count = 0
where is_read is distinct from (unread_count = 0);

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

  perform public.enqueue_notification_delivery(
    v_notif_id,
    p_recipient_id,
    p_notification_type
  );

  return v_notif_id;
end;
$$;

revoke execute on function public.create_notification(uuid, uuid, text, text, text, uuid, jsonb)
from anon, authenticated;
