create table if not exists public.event_participants (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.events (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    role text not null default 'participant',
    added_by uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now(),
    unique (event_id, user_id)
);

create index if not exists event_participants_event_created_idx on public.event_participants (event_id, created_at asc);

create index if not exists event_participants_user_idx on public.event_participants (user_id, created_at desc);

alter table public.event_participants
drop constraint if exists event_participants_role_check;

alter table public.event_participants
add constraint event_participants_role_check check (role in ('participant'));

alter table public.event_participants enable row level security;

drop policy if exists "members can view event participants" on public.event_participants;

create policy "members can view event participants" on public.event_participants for
select
    to authenticated using (
        exists (
            select
                1
            from
                public.events as events
            where
                events.id = event_participants.event_id
                and public.is_active_calendar_member (events.calendar_id)
        )
    );

drop policy if exists "members can manage event participants" on public.event_participants;

create policy "members can manage event participants" on public.event_participants for all to authenticated using (
    exists (
        select
            1
        from
            public.events as events
        where
            events.id = event_participants.event_id
            and public.can_update_calendar_event (
                events.calendar_id,
                events.created_by,
                events.is_locked
            )
    )
)
with
    check (
        exists (
            select
                1
            from
                public.events as events
                join public.calendar_members as members on members.calendar_id = events.calendar_id
                and members.user_id = event_participants.user_id
                and members.status = 'active'
            where
                events.id = event_participants.event_id
                and public.can_update_calendar_event (
                    events.calendar_id,
                    events.created_by,
                    events.is_locked
                )
        )
    );

create or replace function public.set_event_participant_write_metadata () returns trigger language plpgsql
set
    search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_at = coalesce(new.created_at, now());
    new.added_by = coalesce(new.added_by, auth.uid());
  end if;

  return new;
end;
$$;

drop trigger if exists set_event_participant_write_metadata on public.event_participants;

create trigger set_event_participant_write_metadata before insert on public.event_participants for each row
execute function public.set_event_participant_write_metadata ();

create or replace function public.get_event_participants_json (
    target_event_id uuid,
    include_details boolean default true
) returns jsonb language sql security definer stable
set
    search_path = '' as $$
  select case
    when include_details is not true then '[]'::jsonb
    else coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', participants.id,
            'eventId', participants.event_id,
            'userId', participants.user_id,
            'role', participants.role,
            'createdAt', extract(epoch from participants.created_at) * 1000,
            'user', jsonb_build_object(
              'id', participants.user_id,
              'name', nullif(trim(users.raw_user_meta_data ->> 'name'), '')::text,
              'email', users.email::text,
              'avatarUrl', nullif(trim(users.raw_user_meta_data ->> 'avatar_url'), '')::text
            )
          )
          order by participants.created_at asc, participants.id asc
        )
        from public.event_participants as participants
        join auth.users as users on users.id = participants.user_id
        where participants.event_id = target_event_id
      ),
      '[]'::jsonb
    )
  end;
$$;

create or replace function public.replace_calendar_event_participants (target_event_id uuid, target_user_ids uuid[]) returns jsonb language plpgsql security definer
set
    search_path = '' as $$
declare
  current_event public.events;
  normalized_user_ids uuid[] := coalesce(target_user_ids, array[]::uuid[]);
  previous_participants jsonb := '[]'::jsonb;
  next_participants jsonb := '[]'::jsonb;
begin
  select *
  into current_event
  from public.events as events
  where events.id = target_event_id
  for update;

  if not found then
    raise exception 'Event not found'
      using errcode = 'P0002';
  end if;

  if not public.can_update_calendar_event(
    current_event.calendar_id,
    current_event.created_by,
    current_event.is_locked
  ) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  normalized_user_ids := array(
    select distinct user_id
    from unnest(normalized_user_ids) as user_id
    where user_id is not null
  );

  if exists (
    select 1
    from unnest(normalized_user_ids) as user_id
    where not exists (
      select 1
      from public.calendar_members as members
      where members.calendar_id = current_event.calendar_id
        and members.user_id = user_id
        and members.status = 'active'
    )
  ) then
    raise exception 'All event participants must be active calendar members'
      using errcode = '23514';
  end if;

  previous_participants := public.get_event_participants_json(target_event_id, true);

  delete from public.event_participants as participants
  where participants.event_id = target_event_id
    and not (participants.user_id = any(normalized_user_ids));

  insert into public.event_participants (
    event_id,
    user_id,
    role,
    added_by
  )
  select
    target_event_id,
    user_id,
    'participant',
    auth.uid()
  from unnest(normalized_user_ids) as user_id
  on conflict (event_id, user_id)
  do nothing;

  update public.events
  set updated_at = now(),
      updated_by = coalesce(auth.uid(), updated_by, created_by)
  where id = target_event_id;

  next_participants := public.get_event_participants_json(target_event_id, true);

  if previous_participants is distinct from next_participants then
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
      current_event.calendar_id,
      target_event_id,
      'updated',
      auth.uid(),
      '참가자를 변경했습니다.',
      jsonb_build_array(
        public.build_event_history_change(
          'participants',
          '참가자',
          previous_participants,
          next_participants
        )
      ),
      now()
    );
  end if;

  return public.build_calendar_event_realtime_record(target_event_id);
end;
$$;

grant
execute on function public.replace_calendar_event_participants (uuid, uuid[]) to authenticated;

alter table public.events
add column if not exists category_id uuid references public.event_categories (id),
add column if not exists recurrence jsonb,
add column if not exists exceptions jsonb not null default '[]'::jsonb;

update public.events
set
    exceptions = '[]'::jsonb
where
    exceptions is null;

alter table public.events
drop constraint if exists events_recurrence_valid_check;

alter table public.events
add constraint events_recurrence_valid_check check (public.is_valid_event_recurrence (recurrence));

alter table public.events
drop constraint if exists events_exceptions_valid_check;

alter table public.events
add constraint events_exceptions_valid_check check (public.is_valid_event_exceptions (exceptions));

alter table public.events
drop constraint if exists events_category_matches_calendar_check;

alter table public.events
add constraint events_category_matches_calendar_check check (
    public.event_category_matches_calendar (category_id, calendar_id)
);

create or replace function public.upsert_calendar_event_category (target_calendar_id uuid, target_name text) returns uuid language plpgsql security definer
set
    search_path = '' as $$
declare
  normalized_name text := nullif(btrim(target_name), '');
  result_id uuid;
begin
  if normalized_name is null then
    return null;
  end if;

  if not public.has_calendar_role(
    target_calendar_id,
    array['editor', 'manager', 'owner']
  ) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  insert into public.event_categories (
    calendar_id,
    name,
    created_by
  )
  values (
    target_calendar_id,
    normalized_name,
    auth.uid()
  )
  on conflict (calendar_id, (lower(name)))
  do update
    set name = excluded.name,
        updated_at = now()
  returning id into result_id;

  return result_id;
end;
$$;

grant
execute on function public.upsert_calendar_event_category (uuid, text) to authenticated;

drop function if exists public.get_calendar_event_categories (uuid);

create or replace function public.get_calendar_event_categories (target_calendar_id uuid) returns table (
    id uuid,
    calendar_id uuid,
    name text,
    created_by uuid,
    created_at timestamptz,
    updated_at timestamptz
) language plpgsql security definer
set
    search_path = '' as $$
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
    categories.id,
    categories.calendar_id,
    categories.name,
    categories.created_by,
    categories.created_at,
    categories.updated_at
  from public.event_categories as categories
  where categories.calendar_id = target_calendar_id
  order by lower(categories.name) asc, categories.created_at asc;
end;
$$;

grant
execute on function public.get_calendar_event_categories (uuid) to authenticated,
anon;

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
    'category_id', events.category_id,
    'category_name', categories.name,
    'category_created_by', categories.created_by,
    'category_created_at', categories.created_at,
    'category_updated_at', categories.updated_at,
    'recurrence', events.recurrence,
    'exceptions', events.exceptions,
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
  left join public.event_categories as categories on categories.id = events.category_id
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
    category_id uuid,
    category_name text,
    category_created_by uuid,
    category_created_at timestamptz,
    category_updated_at timestamptz,
    recurrence jsonb,
    exceptions jsonb,
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
    events.calendar_id,
    events.title,
    events.content,
    events.start_at,
    events.end_at,
    events.category_id,
    categories.name,
    categories.created_by,
    categories.created_at,
    categories.updated_at,
    events.recurrence,
    events.exceptions,
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
  left join public.event_categories as categories on categories.id = events.category_id
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
    category_id uuid,
    category_name text,
    category_created_by uuid,
    category_created_at timestamptz,
    category_updated_at timestamptz,
    recurrence jsonb,
    exceptions jsonb,
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
    events.calendar_id,
    events.title,
    events.content,
    events.start_at,
    events.end_at,
    events.category_id,
    categories.name,
    categories.created_by,
    categories.created_at,
    categories.updated_at,
    events.recurrence,
    events.exceptions,
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
  left join public.event_categories as categories on categories.id = events.category_id
  left join auth.users as creators on creators.id = events.created_by
  left join auth.users as updaters on updaters.id = events.updated_by
  where events.id = target_event_id;
end;
$$;

grant
execute on function public.get_calendar_event_by_id (uuid) to authenticated,
anon;

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
    when 'category_id' then '카테고리를 변경했습니다.'
    when 'recurrence' then '반복 규칙을 변경했습니다.'
    when 'exceptions' then '예외 일정을 변경했습니다.'
    when 'status' then '상태를 변경했습니다.'
    when 'is_locked' then '잠금 상태를 변경했습니다.'
    else '일정을 수정했습니다.'
  end;
end;
$$;

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
    'category_id', events.category_id,
    'category_name', categories.name,
    'category_created_by', categories.created_by,
    'category_created_at', categories.created_at,
    'category_updated_at', categories.updated_at,
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
  left join public.event_categories as categories on categories.id = events.category_id
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
    events.category_id,
    categories.name,
    categories.created_by,
    categories.created_at,
    categories.updated_at,
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
  left join public.event_categories as categories on categories.id = events.category_id
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
    events.category_id,
    categories.name,
    categories.created_by,
    categories.created_at,
    categories.updated_at,
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
  left join public.event_categories as categories on categories.id = events.category_id
  left join auth.users as creators on creators.id = events.created_by
  left join auth.users as updaters on updaters.id = events.updated_by
  where events.id = target_event_id;
end;
$$;

grant
execute on function public.get_calendar_event_by_id (uuid) to authenticated,
anon;
