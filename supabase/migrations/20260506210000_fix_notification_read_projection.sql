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
as $$
  select
    nd.digest_key,
    nd.count,
    nd.unread_count,
    nd.actor_ids,
    nd.last_occurred_at,
    n.id              as notification_id,
    n.notification_type,
    n.entity_type,
    n.entity_id,
    n.calendar_id,
    n.metadata,
    nd.unread_count = 0 as is_read,
    nd.last_occurred_at as created_at
  from public.notification_digests nd
  join public.notifications n on n.id = nd.latest_notification_id
  where nd.recipient_id = auth.uid()
    and (p_unread_only = false or nd.unread_count > 0)
    and (p_cursor is null or nd.last_occurred_at < p_cursor)
  order by nd.last_occurred_at desc
  limit p_limit
$$;

grant execute on function public.get_notifications to authenticated;
