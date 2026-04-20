alter table public.events
add column if not exists updated_by uuid references auth.users (id);

update public.events
set updated_by = coalesce(updated_by, created_by)
where updated_by is null;

create type public.event_history_action as enum ('created', 'updated', 'deleted');

create table if not exists public.event_history (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  event_id uuid not null,
  action public.event_history_action not null,
  actor_user_id uuid references auth.users (id) on delete set null,
  summary text not null,
  changes jsonb not null default '[]'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists event_history_calendar_occurred_idx
on public.event_history (calendar_id, occurred_at desc);

create index if not exists event_history_event_occurred_idx
on public.event_history (event_id, occurred_at desc);

alter table public.event_history enable row level security;

grant select on public.event_history to authenticated;

drop policy if exists "active members can view event history" on public.event_history;
create policy "active members can view event history"
on public.event_history
for select
to authenticated
using (public.is_active_calendar_member(calendar_id));

create or replace function public.set_event_write_metadata()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by = coalesce(new.created_by, auth.uid());
    new.created_at = coalesce(new.created_at, now());
    new.updated_at = coalesce(new.updated_at, new.created_at, now());
    new.updated_by = coalesce(auth.uid(), new.updated_by, new.created_by);
    return new;
  end if;

  new.updated_at = now();
  new.updated_by = coalesce(
    auth.uid(),
    new.updated_by,
    old.updated_by,
    old.created_by,
    new.created_by
  );

  return new;
end;
$$;

drop trigger if exists set_event_updated_at on public.events;
drop trigger if exists set_event_write_metadata on public.events;
create trigger set_event_write_metadata
before insert or update on public.events
for each row
execute function public.set_event_write_metadata();

create or replace function public.build_event_history_change(
  field_name text,
  field_label text,
  before_value jsonb,
  after_value jsonb,
  include_values boolean default true
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  operation text;
  change_entry jsonb;
begin
  operation := case
    when before_value is null and after_value is not null then 'added'
    when before_value is not null and after_value is null then 'removed'
    else 'changed'
  end;

  change_entry := jsonb_build_object(
    'field', field_name,
    'label', field_label,
    'op', operation
  );

  if include_values then
    change_entry := change_entry || jsonb_build_object(
      'before', before_value,
      'after', after_value
    );
  end if;

  return jsonb_strip_nulls(change_entry);
end;
$$;

create or replace function public.build_calendar_event_history_changes(
  old_event public.events,
  new_event public.events,
  operation text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  changes jsonb := '[]'::jsonb;
begin
  if operation = 'INSERT' then
    return jsonb_build_array(
      jsonb_build_object(
        'field', 'event',
        'label', '일정',
        'op', 'added',
        'after', jsonb_build_object(
          'title', new_event.title,
          'start_at', new_event.start_at,
          'end_at', new_event.end_at,
          'status', new_event.status
        )
      )
    );
  end if;

  if operation = 'DELETE' then
    return jsonb_build_array(
      jsonb_build_object(
        'field', 'event',
        'label', '일정',
        'op', 'removed',
        'before', jsonb_build_object(
          'title', old_event.title,
          'start_at', old_event.start_at,
          'end_at', old_event.end_at,
          'status', old_event.status
        )
      )
    );
  end if;

  if old_event.title is distinct from new_event.title then
    changes := changes || jsonb_build_array(
      public.build_event_history_change(
        'title',
        '제목',
        to_jsonb(old_event.title),
        to_jsonb(new_event.title)
      )
    );
  end if;

  if old_event.content is distinct from new_event.content then
    changes := changes || jsonb_build_array(
      public.build_event_history_change(
        'content',
        '내용',
        null,
        null,
        false
      )
    );
  end if;

  if old_event.start_at is distinct from new_event.start_at then
    changes := changes || jsonb_build_array(
      public.build_event_history_change(
        'start_at',
        '시작 시간',
        to_jsonb(old_event.start_at),
        to_jsonb(new_event.start_at)
      )
    );
  end if;

  if old_event.end_at is distinct from new_event.end_at then
    changes := changes || jsonb_build_array(
      public.build_event_history_change(
        'end_at',
        '종료 시간',
        to_jsonb(old_event.end_at),
        to_jsonb(new_event.end_at)
      )
    );
  end if;

  if old_event.status is distinct from new_event.status then
    changes := changes || jsonb_build_array(
      public.build_event_history_change(
        'status',
        '상태',
        to_jsonb(old_event.status),
        to_jsonb(new_event.status)
      )
    );
  end if;

  if old_event.is_locked is distinct from new_event.is_locked then
    changes := changes || jsonb_build_array(
      public.build_event_history_change(
        'is_locked',
        '잠금',
        to_jsonb(old_event.is_locked),
        to_jsonb(new_event.is_locked)
      )
    );
  end if;

  return changes;
end;
$$;

create or replace function public.build_calendar_event_history_summary(
  target_action public.event_history_action,
  target_changes jsonb
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  change_count integer := coalesce(jsonb_array_length(target_changes), 0);
  first_field text := target_changes -> 0 ->> 'field';
begin
  if target_action = 'created' then
    return '일정을 생성했습니다.';
  end if;

  if target_action = 'deleted' then
    return '일정을 삭제했습니다.';
  end if;

  if change_count <= 0 then
    return '일정을 수정했습니다.';
  end if;

  if change_count > 1 then
    return format('%s개 항목을 변경했습니다.', change_count);
  end if;

  return case first_field
    when 'title' then '제목을 변경했습니다.'
    when 'content' then '내용을 변경했습니다.'
    when 'start_at' then '시작 시간을 변경했습니다.'
    when 'end_at' then '종료 시간을 변경했습니다.'
    when 'status' then '상태를 변경했습니다.'
    when 'is_locked' then '잠금 상태를 변경했습니다.'
    else '일정을 수정했습니다.'
  end;
end;
$$;

create or replace function public.log_calendar_event_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_action public.event_history_action;
  target_changes jsonb;
  target_summary text;
  target_calendar_id uuid := coalesce(new.calendar_id, old.calendar_id);
  target_event_id uuid := coalesce(new.id, old.id);
  actor_id uuid;
begin
  target_action := case tg_op
    when 'INSERT' then 'created'::public.event_history_action
    when 'UPDATE' then 'updated'::public.event_history_action
    when 'DELETE' then 'deleted'::public.event_history_action
  end;

  target_changes := public.build_calendar_event_history_changes(old, new, tg_op);

  if tg_op = 'UPDATE' and jsonb_array_length(target_changes) = 0 then
    return null;
  end if;

  target_summary := public.build_calendar_event_history_summary(
    target_action,
    target_changes
  );

  actor_id := coalesce(
    auth.uid(),
    case when tg_op = 'DELETE' then old.updated_by else new.updated_by end,
    case when tg_op = 'DELETE' then old.created_by else new.created_by end
  );

  insert into public.event_history (
    calendar_id,
    event_id,
    action,
    actor_user_id,
    summary,
    changes,
    occurred_at
  )
  values (
    target_calendar_id,
    target_event_id,
    target_action,
    actor_id,
    target_summary,
    target_changes,
    now()
  );

  return null;
end;
$$;

drop trigger if exists log_calendar_event_history on public.events;
create trigger log_calendar_event_history
after insert or update or delete on public.events
for each row
execute function public.log_calendar_event_history();

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
    'updated_by', events.updated_by,
    'is_locked', events.is_locked,
    'created_at', events.created_at,
    'updated_at', events.updated_at,
    'creator_name', nullif(trim(creators.raw_user_meta_data ->> 'name'), '')::text,
    'creator_email', creators.email::text,
    'creator_avatar_url', nullif(trim(creators.raw_user_meta_data ->> 'avatar_url'), '')::text,
    'updater_name', nullif(trim(updaters.raw_user_meta_data ->> 'name'), '')::text,
    'updater_email', updaters.email::text,
    'updater_avatar_url', nullif(trim(updaters.raw_user_meta_data ->> 'avatar_url'), '')::text
  )
  from public.events as events
  left join auth.users as creators on creators.id = events.created_by
  left join auth.users as updaters on updaters.id = events.updated_by
  where events.id = target_event_id;
$$;

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
  updated_by uuid,
  is_locked boolean,
  created_at timestamptz,
  updated_at timestamptz,
  creator_name text,
  creator_email text,
  creator_avatar_url text,
  updater_name text,
  updater_email text,
  updater_avatar_url text
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
    events.updated_by,
    events.is_locked,
    events.created_at,
    events.updated_at,
    nullif(trim(creators.raw_user_meta_data ->> 'name'), '')::text,
    creators.email::text,
    nullif(trim(creators.raw_user_meta_data ->> 'avatar_url'), '')::text,
    nullif(trim(updaters.raw_user_meta_data ->> 'name'), '')::text,
    updaters.email::text,
    nullif(trim(updaters.raw_user_meta_data ->> 'avatar_url'), '')::text
  from public.events as events
  left join auth.users as creators on creators.id = events.created_by
  left join auth.users as updaters on updaters.id = events.updated_by
  where events.calendar_id = target_calendar_id
  order by events.start_at asc, events.created_at asc;
end;
$$;

grant execute on function public.get_calendar_events_with_authors(uuid) to authenticated, anon;

drop function if exists public.get_calendar_event_by_id(uuid);

create or replace function public.get_calendar_event_by_id(
  target_event_id uuid
)
returns table (
  id uuid,
  title text,
  content jsonb,
  start_at timestamptz,
  end_at timestamptz,
  status public.calendar_event_status,
  created_by uuid,
  updated_by uuid,
  is_locked boolean,
  created_at timestamptz,
  updated_at timestamptz,
  creator_name text,
  creator_email text,
  creator_avatar_url text,
  updater_name text,
  updater_email text,
  updater_avatar_url text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    public.is_active_calendar_member(
      (select events.calendar_id from public.events as events where events.id = target_event_id)
    )
    or public.is_calendar_publicly_viewable(
      (select events.calendar_id from public.events as events where events.id = target_event_id)
    )
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
    events.updated_by,
    events.is_locked,
    events.created_at,
    events.updated_at,
    nullif(trim(creators.raw_user_meta_data ->> 'name'), '')::text,
    creators.email::text,
    nullif(trim(creators.raw_user_meta_data ->> 'avatar_url'), '')::text,
    nullif(trim(updaters.raw_user_meta_data ->> 'name'), '')::text,
    updaters.email::text,
    nullif(trim(updaters.raw_user_meta_data ->> 'avatar_url'), '')::text
  from public.events as events
  left join auth.users as creators on creators.id = events.created_by
  left join auth.users as updaters on updaters.id = events.updated_by
  where events.id = target_event_id;
end;
$$;

grant execute on function public.get_calendar_event_by_id(uuid) to authenticated, anon;

drop function if exists public.get_calendar_event_history(uuid, integer, integer);

create or replace function public.get_calendar_event_history(
  target_event_id uuid,
  history_limit integer default 50,
  history_offset integer default 0
)
returns table (
  id uuid,
  calendar_id uuid,
  event_id uuid,
  action public.event_history_action,
  actor_user_id uuid,
  summary text,
  changes jsonb,
  occurred_at timestamptz,
  actor_name text,
  actor_email text,
  actor_avatar_url text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_calendar_id uuid;
begin
  select coalesce(
    (
      select events.calendar_id
      from public.events as events
      where events.id = target_event_id
      limit 1
    ),
    (
      select history.calendar_id
      from public.event_history as history
      where history.event_id = target_event_id
      order by history.occurred_at desc
      limit 1
    )
  )
  into resolved_calendar_id;

  if resolved_calendar_id is null then
    return;
  end if;

  if not public.is_active_calendar_member(resolved_calendar_id) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  return query
  select
    history.id,
    history.calendar_id,
    history.event_id,
    history.action,
    history.actor_user_id,
    history.summary,
    history.changes,
    history.occurred_at,
    nullif(trim(users.raw_user_meta_data ->> 'name'), '')::text,
    users.email::text,
    nullif(trim(users.raw_user_meta_data ->> 'avatar_url'), '')::text
  from public.event_history as history
  left join auth.users as users on users.id = history.actor_user_id
  where history.calendar_id = resolved_calendar_id
    and history.event_id = target_event_id
  order by history.occurred_at desc, history.id desc
  limit greatest(coalesce(history_limit, 50), 0)
  offset greatest(coalesce(history_offset, 0), 0);
end;
$$;

grant execute on function public.get_calendar_event_history(uuid, integer, integer) to authenticated;
