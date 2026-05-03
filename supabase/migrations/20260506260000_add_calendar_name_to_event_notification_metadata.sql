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
  calendar_name_val text;
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

  select name into calendar_name_val
  from public.calendars
  where id = rec.calendar_id;

  if rec.action = 'updated' and rec.changes is not null then
    select array_agg(elem ->> 'field')
    into changed_fields
    from jsonb_array_elements(rec.changes) as elem
    where elem ->> 'field' is not null;
  end if;

  metadata_val := jsonb_build_object(
    'title',          coalesce(event_title_val, ''),
    'calendarName',   coalesce(calendar_name_val, ''),
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
