create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function public.get_notification_delivery_function_url()
returns text
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_url text;
begin
  select decrypted_secret
  into v_url
  from vault.decrypted_secrets
  where name = 'notification_delivery_function_url'
  limit 1;

  return nullif(trim(v_url), '');
exception
  when undefined_table then
    return null;
end;
$$;

revoke execute on function public.get_notification_delivery_function_url()
from public, anon, authenticated;

create or replace function public.get_notification_delivery_webhook_secret()
returns text
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_secret text;
begin
  select decrypted_secret
  into v_secret
  from vault.decrypted_secrets
  where name = 'notification_delivery_webhook_secret'
  limit 1;

  return nullif(trim(v_secret), '');
exception
  when undefined_table then
    return null;
end;
$$;

revoke execute on function public.get_notification_delivery_webhook_secret()
from public, anon, authenticated;

create or replace function public.begin_notification_delivery_job(
  p_job_id uuid
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
  update public.notification_delivery_queue as queue
  set
    status = 'processing',
    attempt_count = queue.attempt_count + 1,
    last_attempted_at = now(),
    locked_at = now(),
    updated_at = now()
  where queue.id = p_job_id
    and queue.status in ('pending', 'failed')
    and coalesce(array_length(queue.channels, 1), 0) > 0
    and queue.attempt_count < 5
    and (
      queue.locked_at is null
      or queue.locked_at < now() - interval '2 minutes'
    )
  returning
    queue.id,
    queue.notification_id,
    queue.recipient_id,
    queue.channels;
$$;

revoke execute on function public.begin_notification_delivery_job(uuid)
from public, anon, authenticated;

create or replace function public.dispatch_notification_delivery_job(
  p_job_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_request_id bigint;
begin
  select public.get_notification_delivery_function_url()
  into v_url;

  select public.get_notification_delivery_webhook_secret()
  into v_secret;

  if v_url is null or v_secret is null then
    raise warning '[notification_delivery] webhook config missing for job %', p_job_id;
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notification-webhook-secret', v_secret
    ),
    body := jsonb_build_object('jobId', p_job_id)
  )
  into v_request_id;

  return v_request_id;
exception
  when others then
    raise warning '[notification_delivery] dispatch failed for job %: %', p_job_id, sqlerrm;
    return null;
end;
$$;

revoke execute on function public.dispatch_notification_delivery_job(uuid)
from public, anon, authenticated;

create or replace function public.dispatch_pending_notification_delivery_jobs(
  p_limit int default 50
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job record;
  v_count int := 0;
begin
  for v_job in
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
    limit greatest(coalesce(p_limit, 50), 1)
  loop
    perform public.dispatch_notification_delivery_job(v_job.id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.dispatch_pending_notification_delivery_jobs(int)
from public, anon, authenticated;

create or replace function public.handle_notification_delivery_queue_dispatch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending'
     and coalesce(array_length(new.channels, 1), 0) > 0
     and (
       tg_op = 'INSERT'
       or old.status is distinct from new.status
       or old.channels is distinct from new.channels
     ) then
    perform public.dispatch_notification_delivery_job(new.id);
  end if;

  return new;
exception
  when others then
    raise warning '[notification_delivery] queue trigger failed for job %: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists notification_delivery_queue_dispatch on public.notification_delivery_queue;

create trigger notification_delivery_queue_dispatch
after insert or update of status, channels
on public.notification_delivery_queue
for each row
execute function public.handle_notification_delivery_queue_dispatch();

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'notification-delivery-dispatch'
  ) then
    perform cron.unschedule('notification-delivery-dispatch');
  end if;
exception
  when undefined_table then
    null;
end $$;

select cron.schedule(
  'notification-delivery-dispatch',
  '* * * * *',
  $$
    select public.dispatch_pending_notification_delivery_jobs(100);
  $$
);
