create or replace function public.create_notification_if_absent(
  p_recipient_id uuid,
  p_actor_id uuid,
  p_notification_type text,
  p_entity_type text,
  p_entity_id text,
  p_calendar_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_dedupe_window_seconds int default 30
)
returns table (
  notification_id uuid,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_digest_key text;
  v_existing_id uuid;
  v_window_seconds int := greatest(coalesce(p_dedupe_window_seconds, 30), 0);
  v_lock_key bigint;
begin
  v_digest_key := p_notification_type || ':' || p_entity_type || ':' || p_entity_id;
  v_lock_key := hashtextextended(
    p_recipient_id::text || '|' || coalesce(p_actor_id::text, 'null') || '|' || v_digest_key,
    0
  );

  perform pg_advisory_xact_lock(v_lock_key);

  select notifications.id
  into v_existing_id
  from public.notifications
  where notifications.recipient_id = p_recipient_id
    and notifications.actor_id is not distinct from p_actor_id
    and notifications.digest_key = v_digest_key
    and notifications.created_at >= now() - make_interval(secs => v_window_seconds)
  order by notifications.created_at desc
  limit 1;

  if v_existing_id is not null then
    return query
    select v_existing_id, false;
    return;
  end if;

  return query
  select public.create_notification(
    p_recipient_id      := p_recipient_id,
    p_actor_id          := p_actor_id,
    p_notification_type := p_notification_type,
    p_entity_type       := p_entity_type,
    p_entity_id         := p_entity_id,
    p_calendar_id       := p_calendar_id,
    p_metadata          := p_metadata
  ), true;
end;
$$;

revoke execute on function public.create_notification_if_absent(
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  jsonb,
  int
)
from anon, authenticated;

drop function if exists public.claim_notification_delivery_jobs(int);

create or replace function public.finalize_notification_delivery_job(
  p_job_id uuid,
  p_status text,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('sent', 'failed', 'noop') then
    raise exception 'invalid notification delivery status: %', p_status;
  end if;

  update public.notification_delivery_queue
  set
    status = p_status,
    processed_at = case
      when p_status in ('sent', 'noop') then now()
      else null
    end,
    locked_at = null,
    last_error = case
      when p_status = 'failed' then left(p_error, 2000)
      else null
    end,
    updated_at = now()
  where id = p_job_id;
end;
$$;

revoke execute on function public.finalize_notification_delivery_job(uuid, text, text)
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
  perform public.finalize_notification_delivery_job(
    p_job_id := p_job_id,
    p_status := case when p_success then 'sent' else 'failed' end,
    p_error := p_error
  );
end;
$$;

revoke execute on function public.complete_notification_delivery_job(uuid, boolean, text)
from public, anon, authenticated;
