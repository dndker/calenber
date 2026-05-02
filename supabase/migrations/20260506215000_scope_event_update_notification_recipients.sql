-- event_updated 알림 수신 범위를 일정 관련자로 제한한다.
--
-- 실무 기준:
--   - event_created / event_deleted: 캘린더 맥락 알림이므로 기존처럼 활성 멤버 기준 유지
--   - event_updated: 노이즈를 줄이기 위해 실제 관련자에게만 발송
--       1) event_participants 참가자
--       2) 본문 mention 으로 태그된 사용자
--       3) event_favorites 로 즐겨찾기한 사용자

create or replace function public.get_event_mentioned_user_ids(
  target_content jsonb
)
returns uuid[]
language sql
immutable
set search_path = ''
as $$
  with mentioned_values as (
    select trim(both '"' from mentioned.value::text) as user_id_text
    from jsonb_path_query(
      coalesce(target_content, 'null'::jsonb),
      '$.** ? (@.type == "mention").props.userId'
    ) as mentioned(value)
  )
  select coalesce(
    array_agg(distinct user_id_text::uuid),
    array[]::uuid[]
  )
  from mentioned_values
  where user_id_text ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
$$;

create or replace function public.get_event_interested_notification_recipient_ids(
  target_event_id uuid
)
returns uuid[]
language sql
security definer
stable
set search_path = ''
as $$
  with event_context as (
    select
      events.id,
      events.calendar_id,
      events.content
    from public.events as events
    where events.id = target_event_id
  ),
  interested_users as (
    select participants.user_id
    from event_context
    join public.event_participants as participants
      on participants.event_id = event_context.id

    union

    select favorites.user_id
    from event_context
    join public.event_favorites as favorites
      on favorites.event_id = event_context.id

    union

    select mentioned.user_id
    from event_context
    cross join lateral unnest(
      public.get_event_mentioned_user_ids(event_context.content)
    ) as mentioned(user_id)
  )
  select coalesce(
    array_agg(distinct members.user_id),
    array[]::uuid[]
  )
  from event_context
  join public.calendar_members as members
    on members.calendar_id = event_context.calendar_id
   and members.status = 'active'
  join interested_users
    on interested_users.user_id = members.user_id;
$$;

revoke execute on function public.get_event_mentioned_user_ids(jsonb)
from public, anon, authenticated;

revoke execute on function public.get_event_interested_notification_recipient_ids(uuid)
from public, anon, authenticated;

create or replace function public.notify_event_history_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec              public.event_history;
  notif_type       text;
  entity_type_val  text := 'event';
  metadata_val     jsonb;
  member_row       record;
  actor_name_val   text;
  actor_avatar_val text;
  event_title_val  text;
  changed_fields   text[];
begin
  rec := new;

  notif_type := case rec.action
    when 'created' then 'event_created'
    when 'updated' then 'event_updated'
    when 'deleted' then 'event_deleted'
    else null
  end;

  if notif_type is null then
    return new;
  end if;

  select
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'avatar_url'), '')
  into actor_name_val, actor_avatar_val
  from auth.users u
  where u.id = rec.actor_user_id;

  select title into event_title_val
  from public.events
  where id = rec.event_id;

  if event_title_val is null then
    event_title_val := rec.summary;
  end if;

  if rec.action = 'updated' and rec.changes is not null then
    select array_agg(elem ->> 'field')
    into changed_fields
    from jsonb_array_elements(rec.changes) as elem
    where elem ->> 'field' is not null;
  end if;

  metadata_val := jsonb_build_object(
    'title',          coalesce(event_title_val, ''),
    'actorName',      coalesce(actor_name_val, ''),
    'actorAvatarUrl', coalesce(actor_avatar_val, ''),
    'changedFields',  coalesce(to_jsonb(changed_fields), '[]'::jsonb)
  );

  for member_row in
    with recipients as (
      select cm.user_id
      from public.calendar_members as cm
      where notif_type in ('event_created', 'event_deleted')
        and cm.calendar_id = rec.calendar_id
        and cm.status = 'active'

      union

      select recipient.user_id
      from unnest(
        coalesce(
          case
            when notif_type = 'event_updated'
              then public.get_event_interested_notification_recipient_ids(rec.event_id)
            else array[]::uuid[]
          end,
          array[]::uuid[]
        )
      ) as recipient(user_id)
    )
    select distinct recipients.user_id
    from recipients
    where recipients.user_id is distinct from rec.actor_user_id
  loop
    begin
      perform public.create_notification(
        p_recipient_id      := member_row.user_id,
        p_actor_id          := rec.actor_user_id,
        p_notification_type := notif_type,
        p_entity_type       := entity_type_val,
        p_entity_id         := rec.event_id::text,
        p_calendar_id       := rec.calendar_id,
        p_metadata          := metadata_val
      );
    exception when others then
      raise warning '[notify_event_history] create_notification failed for recipient %: %', member_row.user_id, sqlerrm;
    end;
  end loop;

  return new;
end;
$$;
