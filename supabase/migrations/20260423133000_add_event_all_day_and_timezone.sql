alter table public.events
add column if not exists all_day boolean not null default false,
add column if not exists timezone text not null default 'Asia/Seoul';

update public.events
set timezone = 'Asia/Seoul'
where nullif(btrim(timezone), '') is null;

update public.events
set all_day = true
where start_at is not null
  and end_at is not null
  and timezone = 'Asia/Seoul'
  and timezone('Asia/Seoul', start_at) = date_trunc('day', timezone('Asia/Seoul', start_at))
  and timezone('Asia/Seoul', end_at) = date_trunc('day', timezone('Asia/Seoul', end_at)) + interval '1 day' - interval '1 millisecond';

create or replace function public.build_calendar_event_history_changes (
    old_event public.events,
    new_event public.events,
    operation text
) returns jsonb language plpgsql
set
    search_path = '' as $$
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
          'all_day', new_event.all_day,
          'timezone', new_event.timezone,
          'status', new_event.status,
          'category_id', new_event.category_id,
          'recurrence', new_event.recurrence,
          'exceptions', new_event.exceptions
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
          'all_day', old_event.all_day,
          'timezone', old_event.timezone,
          'status', old_event.status,
          'category_id', old_event.category_id,
          'recurrence', old_event.recurrence,
          'exceptions', old_event.exceptions
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

  if old_event.all_day is distinct from new_event.all_day then
    changes := changes || jsonb_build_array(
      public.build_event_history_change(
        'all_day',
        '하루종일',
        to_jsonb(old_event.all_day),
        to_jsonb(new_event.all_day)
      )
    );
  end if;

  if old_event.timezone is distinct from new_event.timezone then
    changes := changes || jsonb_build_array(
      public.build_event_history_change(
        'timezone',
        '시간대',
        to_jsonb(old_event.timezone),
        to_jsonb(new_event.timezone)
      )
    );
  end if;

  if old_event.category_id is distinct from new_event.category_id then
    changes := changes || jsonb_build_array(
      public.build_event_history_change(
        'category_id',
        '카테고리',
        to_jsonb(old_event.category_id),
        to_jsonb(new_event.category_id)
      )
    );
  end if;

  if old_event.recurrence is distinct from new_event.recurrence then
    changes := changes || jsonb_build_array(
      public.build_event_history_change(
        'recurrence',
        '반복',
        old_event.recurrence,
        new_event.recurrence
      )
    );
  end if;

  if old_event.exceptions is distinct from new_event.exceptions then
    changes := changes || jsonb_build_array(
      public.build_event_history_change(
        'exceptions',
        '예외',
        old_event.exceptions,
        new_event.exceptions
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

create or replace function public.build_calendar_event_history_summary (
    target_action public.event_history_action,
    target_changes jsonb
) returns text language plpgsql immutable
set
    search_path = '' as $$
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
    when 'all_day' then '하루종일 여부를 변경했습니다.'
    when 'timezone' then '시간대를 변경했습니다.'
    when 'category_id' then '카테고리를 변경했습니다.'
    when 'recurrence' then '반복 규칙을 변경했습니다.'
    when 'exceptions' then '예외 일정을 변경했습니다.'
    when 'status' then '상태를 변경했습니다.'
    when 'is_locked' then '잠금 상태를 변경했습니다.'
    else '일정을 수정했습니다.'
  end;
end;
$$;

create or replace function public.build_calendar_event_realtime_record (target_event_id uuid) returns jsonb language sql security definer
set
    search_path = '' as $$
  select jsonb_build_object(
    'id', events.id,
    'calendar_id', events.calendar_id,
    'title', events.title,
    'content', events.content,
    'start_at', events.start_at,
    'end_at', events.end_at,
    'all_day', events.all_day,
    'timezone', events.timezone,
    'categories', public.get_event_categories_json(events.id, true),
    'category_id', events.category_id,
    'category_name', primary_category.name,
    'category_created_by', primary_category.created_by,
    'category_created_at', primary_category.created_at,
    'category_updated_at', primary_category.updated_at,
    'recurrence', events.recurrence,
    'exceptions', events.exceptions,
    'participants', public.get_event_participants_json(events.id, true),
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
  left join public.event_categories as primary_category on primary_category.id = events.category_id
  left join auth.users as creators on creators.id = events.created_by
  left join auth.users as updaters on updaters.id = events.updated_by
  where events.id = target_event_id;
$$;

drop function if exists public.get_calendar_events_with_authors (uuid);

create or replace function public.get_calendar_events_with_authors (target_calendar_id uuid) returns table (
    id uuid,
    calendar_id uuid,
    title text,
    content jsonb,
    start_at timestamptz,
    end_at timestamptz,
    all_day boolean,
    timezone text,
    categories jsonb,
    category_id uuid,
    category_name text,
    category_created_by uuid,
    category_created_at timestamptz,
    category_updated_at timestamptz,
    recurrence jsonb,
    exceptions jsonb,
    participants jsonb,
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
) language plpgsql security definer
set
    search_path = '' as $$
declare
  include_participants boolean;
begin
  if not (
    public.is_active_calendar_member(target_calendar_id)
    or public.is_calendar_publicly_viewable(target_calendar_id)
  ) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  include_participants := public.is_active_calendar_member(target_calendar_id);

  return query
  select
    events.id,
    events.calendar_id,
    events.title,
    events.content,
    events.start_at,
    events.end_at,
    events.all_day,
    events.timezone,
    public.get_event_categories_json(events.id, true),
    events.category_id,
    primary_category.name,
    primary_category.created_by,
    primary_category.created_at,
    primary_category.updated_at,
    events.recurrence,
    events.exceptions,
    public.get_event_participants_json(events.id, include_participants),
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
  left join public.event_categories as primary_category on primary_category.id = events.category_id
  left join auth.users as creators on creators.id = events.created_by
  left join auth.users as updaters on updaters.id = events.updated_by
  where events.calendar_id = target_calendar_id
  order by events.start_at asc, events.created_at asc;
end;
$$;

grant
execute on function public.get_calendar_events_with_authors (uuid) to authenticated,
anon;

drop function if exists public.get_calendar_event_by_id (uuid);

create or replace function public.get_calendar_event_by_id (target_event_id uuid) returns table (
    id uuid,
    calendar_id uuid,
    title text,
    content jsonb,
    start_at timestamptz,
    end_at timestamptz,
    all_day boolean,
    timezone text,
    categories jsonb,
    category_id uuid,
    category_name text,
    category_created_by uuid,
    category_created_at timestamptz,
    category_updated_at timestamptz,
    recurrence jsonb,
    exceptions jsonb,
    participants jsonb,
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
) language plpgsql security definer
set
    search_path = '' as $$
declare
  resolved_calendar_id uuid;
  include_participants boolean;
begin
  select events.calendar_id
  into resolved_calendar_id
  from public.events as events
  where events.id = target_event_id;

  if not (
    public.is_active_calendar_member(resolved_calendar_id)
    or public.is_calendar_publicly_viewable(resolved_calendar_id)
  ) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  include_participants := public.is_active_calendar_member(resolved_calendar_id);

  return query
  select
    events.id,
    events.calendar_id,
    events.title,
    events.content,
    events.start_at,
    events.end_at,
    events.all_day,
    events.timezone,
    public.get_event_categories_json(events.id, true),
    events.category_id,
    primary_category.name,
    primary_category.created_by,
    primary_category.created_at,
    primary_category.updated_at,
    events.recurrence,
    events.exceptions,
    public.get_event_participants_json(events.id, include_participants),
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
  left join public.event_categories as primary_category on primary_category.id = events.category_id
  left join auth.users as creators on creators.id = events.created_by
  left join auth.users as updaters on updaters.id = events.updated_by
  where events.id = target_event_id;
end;
$$;

grant
execute on function public.get_calendar_event_by_id (uuid) to authenticated,
anon;

drop function if exists public.update_calendar_event_with_conflict_resolution (uuid, timestamptz, jsonb, text[]);

create or replace function public.update_calendar_event_with_conflict_resolution (
    target_event_id uuid,
    expected_updated_at timestamptz,
    patch jsonb,
    changed_fields text[]
) returns table (
    status text,
    conflicting_fields text[],
    record jsonb
) language plpgsql security definer
set
    search_path = '' as $$
declare
  current_event public.events;
  remote_changed_fields text[] := array[]::text[];
  overlapping_fields text[] := array[]::text[];
begin
  select *
  into current_event
  from public.events as events
  where events.id = target_event_id
  for update;

  if not found then
    return query
    select
      'not_found'::text,
      array[]::text[],
      null::jsonb;
    return;
  end if;

  if not public.can_update_calendar_event(
    current_event.calendar_id,
    current_event.created_by,
    current_event.is_locked
  ) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  if current_event.updated_at is distinct from expected_updated_at then
    select coalesce(
      array_agg(distinct field_name),
      array[]::text[]
    )
    into remote_changed_fields
    from (
      select change_entry ->> 'field' as field_name
      from public.event_history as history
      cross join lateral jsonb_array_elements(history.changes) as change_entry
      where history.event_id = target_event_id
        and history.action = 'updated'
        and history.occurred_at > expected_updated_at
        and history.actor_user_id is distinct from auth.uid()
        and change_entry ? 'field'
    ) as changed;

    select coalesce(
      array_agg(distinct field_name),
      array[]::text[]
    )
    into overlapping_fields
    from (
      select unnest(coalesce(changed_fields, array[]::text[])) as field_name
      intersect
      select unnest(remote_changed_fields) as field_name
    ) as overlapping;

    if coalesce(array_length(overlapping_fields, 1), 0) > 0 then
      return query
      select
        'conflict'::text,
        overlapping_fields,
        public.build_calendar_event_realtime_record(target_event_id);
      return;
    end if;
  end if;

  update public.events as events
  set
    title = case
      when patch ? 'title' then patch ->> 'title'
      else events.title
    end,
    content = case
      when patch ? 'content' then patch -> 'content'
      else events.content
    end,
    start_at = case
      when patch ? 'start_at' then (patch ->> 'start_at')::timestamptz
      else events.start_at
    end,
    end_at = case
      when patch ? 'end_at' then (patch ->> 'end_at')::timestamptz
      else events.end_at
    end,
    all_day = case
      when patch ? 'all_day' then (patch ->> 'all_day')::boolean
      else events.all_day
    end,
    timezone = case
      when patch ? 'timezone' then nullif(patch ->> 'timezone', '')
      else events.timezone
    end,
    category_id = case
      when patch ? 'category_id' then (patch ->> 'category_id')::uuid
      else events.category_id
    end,
    recurrence = case
      when patch ? 'recurrence' then case
        when patch -> 'recurrence' = 'null'::jsonb then null
        else patch -> 'recurrence'
      end
      else events.recurrence
    end,
    exceptions = case
      when patch ? 'exceptions' then patch -> 'exceptions'
      else events.exceptions
    end,
    status = case
      when patch ? 'status' then (patch ->> 'status')::public.calendar_event_status
      else events.status
    end,
    is_locked = case
      when patch ? 'is_locked' then (patch ->> 'is_locked')::boolean
      else events.is_locked
    end
  where events.id = target_event_id;

  return query
  select
    case
      when current_event.updated_at is distinct from expected_updated_at then 'merged'
      else 'updated'
    end::text,
    array[]::text[],
    public.build_calendar_event_realtime_record(target_event_id);
end;
$$;

grant
execute on function public.update_calendar_event_with_conflict_resolution (uuid, timestamptz, jsonb, text[]) to authenticated;
