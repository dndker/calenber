-- ================================================================
-- category_id 컬럼 참조가 남은 함수 전면 수정
--
-- 20260428180000_rename_category_to_collection.sql 에서
-- build_calendar_event_history_changes 와
-- update_calendar_event_with_conflict_resolution 두 함수가
-- DROP + CREATE 없이 그대로 남아 category_id 를 참조한 채 DB에 살아있다.
--
-- 이 두 함수는 20260423133000 에서 정의된 버전이 그대로 남아
-- INSERT 시 log_calendar_event_history 트리거 →
-- build_calendar_event_history_changes 호출 → new_event.category_id 접근 →
-- 42703 "record has no field category_id" 에러를 유발한다.
--
-- 또한 is_valid_event_category_color / random_event_category_color 함수가
-- 여전히 DB에 남아 있고, 이 이름 자체가 category 참조이므로
-- is_valid_event_collection_color / random_event_collection_color 로 교체한다.
-- ================================================================

-- ----------------------------------------------------------------
-- 1) build_calendar_event_history_changes
--    category_id → primary_collection_id
-- ----------------------------------------------------------------

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
          'all_day', new_event.all_day,
          'timezone', new_event.timezone,
          'status', new_event.status,
          'primary_collection_id', new_event.primary_collection_id,
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
          'primary_collection_id', old_event.primary_collection_id,
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

  if old_event.primary_collection_id is distinct from new_event.primary_collection_id then
    changes := changes || jsonb_build_array(
      public.build_event_history_change(
        'primary_collection_id',
        '컬렉션',
        to_jsonb(old_event.primary_collection_id),
        to_jsonb(new_event.primary_collection_id)
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

-- ----------------------------------------------------------------
-- 2) build_calendar_event_history_summary
--    'category_id' label → 'primary_collection_id' (history 표시 문자열)
-- ----------------------------------------------------------------

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
    when 'all_day' then '하루종일 여부를 변경했습니다.'
    when 'timezone' then '시간대를 변경했습니다.'
    when 'primary_collection_id' then '컬렉션을 변경했습니다.'
    when 'collections' then '컬렉션을 변경했습니다.'
    when 'recurrence' then '반복 규칙을 변경했습니다.'
    when 'exceptions' then '예외 일정을 변경했습니다.'
    when 'status' then '상태를 변경했습니다.'
    when 'is_locked' then '잠금 상태를 변경했습니다.'
    else '일정을 수정했습니다.'
  end;
end;
$$;

-- ----------------------------------------------------------------
-- 3) update_calendar_event_with_conflict_resolution
--    category_id → primary_collection_id
-- ----------------------------------------------------------------

drop function if exists public.update_calendar_event_with_conflict_resolution(uuid, timestamptz, jsonb, text[]);

create or replace function public.update_calendar_event_with_conflict_resolution(
  target_event_id uuid,
  expected_updated_at timestamptz,
  patch jsonb,
  changed_fields text[]
)
returns table (
  status text,
  conflicting_fields text[],
  record jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
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
    primary_collection_id = case
      when patch ? 'primary_collection_id' then (patch ->> 'primary_collection_id')::uuid
      else events.primary_collection_id
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

grant execute on function public.update_calendar_event_with_conflict_resolution(uuid, timestamptz, jsonb, text[]) to authenticated;

-- ----------------------------------------------------------------
-- 4) is_valid_event_category_color / random_event_category_color
--    → is_valid_event_collection_color / random_event_collection_color
--    (기존 함수는 남겨두되 collection 명칭 버전을 생성/보장)
-- ----------------------------------------------------------------

create or replace function public.is_valid_event_collection_color(target text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(target = any (array[
    'blue',
    'green',
    'sky',
    'purple',
    'red',
    'orange',
    'yellow',
    'gray',
    'olive',
    'pink',
    'brown'
  ]), false);
$$;

create or replace function public.random_event_collection_color()
returns text
language sql
volatile
set search_path = ''
as $$
  select (
    array[
      'blue',
      'green',
      'sky',
      'purple',
      'red',
      'orange',
      'yellow',
      'gray',
      'olive',
      'pink',
      'brown'
    ]
  )[1 + floor(random() * 11)::int];
$$;
