alter table public.events
add column if not exists updated_at timestamptz not null default now();

update public.events
set updated_at = created_at
where updated_at is distinct from created_at;

create or replace function public.set_event_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_event_updated_at on public.events;
create trigger set_event_updated_at
before update on public.events
for each row
execute function public.set_event_updated_at();

create or replace function public.get_calendar_workspace_topic(
  target_calendar_id uuid
)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'calendar:' || target_calendar_id::text || ':workspace';
$$;

create or replace function public.get_calendar_id_from_workspace_topic(
  target_topic text
)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  parsed_calendar_id text;
begin
  if split_part(target_topic, ':', 1) <> 'calendar' then
    return null;
  end if;

  if split_part(target_topic, ':', 3) <> 'workspace' then
    return null;
  end if;

  parsed_calendar_id := split_part(target_topic, ':', 2);

  begin
    return parsed_calendar_id::uuid;
  exception
    when others then
      return null;
  end;
end;
$$;

create or replace function public.can_access_calendar_workspace_topic(
  target_topic text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with requested_calendar as (
    select public.get_calendar_id_from_workspace_topic(target_topic) as calendar_id
  )
  select exists (
    select 1
    from requested_calendar
    where calendar_id is not null
      and (
        public.is_active_calendar_member(calendar_id)
        or public.is_calendar_publicly_viewable(calendar_id)
      )
  );
$$;

drop policy if exists "calendar workspace realtime read" on realtime.messages;
create policy "calendar workspace realtime read"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and public.can_access_calendar_workspace_topic((select realtime.topic()))
);

drop policy if exists "calendar workspace realtime write" on realtime.messages;
create policy "calendar workspace realtime write"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and public.can_access_calendar_workspace_topic((select realtime.topic()))
);

create or replace function public.build_calendar_event_realtime_record(
  target_event_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', events.id,
    'title', events.title,
    'content', events.content,
    'start_at', events.start_at,
    'end_at', events.end_at,
    'status', events.status,
    'created_by', events.created_by,
    'is_locked', events.is_locked,
    'created_at', events.created_at,
    'updated_at', events.updated_at,
    'creator_name', nullif(trim(users.raw_user_meta_data ->> 'name'), '')::text,
    'creator_email', users.email::text,
    'creator_avatar_url', nullif(trim(users.raw_user_meta_data ->> 'avatar_url'), '')::text
  )
  from public.events as events
  left join auth.users as users on users.id = events.created_by
  where events.id = target_event_id;
$$;

create or replace function public.broadcast_calendar_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_calendar_id uuid := coalesce(new.calendar_id, old.calendar_id);
  target_event_id uuid := coalesce(new.id, old.id);
  target_topic text := public.get_calendar_workspace_topic(target_calendar_id);
  target_event_name text;
  target_payload jsonb;
begin
  target_event_name := case tg_op
    when 'INSERT' then 'calendar.event.created'
    when 'UPDATE' then 'calendar.event.updated'
    when 'DELETE' then 'calendar.event.deleted'
    else 'calendar.event.changed'
  end;

  target_payload := jsonb_build_object(
    'entity', 'event',
    'operation', lower(tg_op),
    'calendarId', target_calendar_id,
    'eventId', target_event_id,
    'occurredAt', timezone('utc', now())
  );

  if tg_op = 'DELETE' then
    target_payload := target_payload || jsonb_build_object(
      'record',
      jsonb_build_object(
        'id', old.id,
        'calendar_id', old.calendar_id
      )
    );
  else
    target_payload := target_payload || jsonb_build_object(
      'record',
      public.build_calendar_event_realtime_record(target_event_id)
    );
  end if;

  perform realtime.send(
    target_payload,
    target_event_name,
    target_topic,
    true
  );

  return null;
end;
$$;

drop trigger if exists broadcast_calendar_event_change on public.events;
create trigger broadcast_calendar_event_change
after insert or update or delete on public.events
for each row
execute function public.broadcast_calendar_event_change();

drop function if exists public.get_calendar_events_with_authors(uuid);

create or replace function public.get_calendar_events_with_authors(
  target_calendar_id uuid
)
returns table (
  id uuid,
  title text,
  content jsonb,
  start_at timestamptz,
  end_at timestamptz,
  status public.calendar_event_status,
  created_by uuid,
  is_locked boolean,
  created_at timestamptz,
  updated_at timestamptz,
  creator_name text,
  creator_email text,
  creator_avatar_url text
)
language plpgsql
security definer
set search_path = ''
as $$
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
    events.id,
    events.title,
    events.content,
    events.start_at,
    events.end_at,
    events.status,
    events.created_by,
    events.is_locked,
    events.created_at,
    events.updated_at,
    nullif(trim(users.raw_user_meta_data ->> 'name'), '')::text,
    users.email::text,
    nullif(trim(users.raw_user_meta_data ->> 'avatar_url'), '')::text
  from public.events as events
  left join auth.users as users on users.id = events.created_by
  where events.calendar_id = target_calendar_id
  order by events.start_at asc, events.created_at asc;
end;
$$;

grant execute on function public.get_calendar_events_with_authors(uuid) to authenticated, anon;
