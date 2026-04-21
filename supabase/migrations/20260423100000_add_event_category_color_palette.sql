create or replace function public.is_valid_event_category_color (target text) returns boolean language sql immutable
set
    search_path = '' as $$
  select coalesce(target = any (array[
    'blue',
    'green',
    'sky',
    'purple',
    'red',
    'yellow',
    'gray',
    'olive',
    'pink',
    'mauve'
  ]), false);
$$;

create or replace function public.random_event_category_color () returns text language sql volatile
set
    search_path = '' as $$
  select (
    array[
      'blue',
      'green',
      'sky',
      'purple',
      'red',
      'yellow',
      'gray',
      'olive',
      'pink',
      'mauve'
    ]
  )[1 + floor(random() * 10)::int];
$$;

create or replace function public.is_valid_event_category_options (target jsonb) returns boolean language plpgsql immutable
set
    search_path = '' as $$
begin
  if target is null then
    return false;
  end if;

  if jsonb_typeof(target) <> 'object' then
    return false;
  end if;

  if jsonb_typeof(target -> 'visibleByDefault') <> 'boolean' then
    return false;
  end if;

  if jsonb_typeof(target -> 'color') <> 'string' then
    return false;
  end if;

  if not public.is_valid_event_category_color(target ->> 'color') then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;

alter table public.event_categories
alter column options set default jsonb_build_object(
  'visibleByDefault',
  true,
  'color',
  public.random_event_category_color()
);

update public.event_categories
set options = jsonb_build_object(
  'visibleByDefault',
  coalesce((options ->> 'visibleByDefault')::boolean, true),
  'color',
  case
    when public.is_valid_event_category_color(options ->> 'color') then options ->> 'color'
    else public.random_event_category_color()
  end
)
where options is null
   or jsonb_typeof(options) <> 'object'
   or jsonb_typeof(options -> 'visibleByDefault') <> 'boolean'
   or jsonb_typeof(options -> 'color') <> 'string'
   or not public.is_valid_event_category_color(options ->> 'color');

alter table public.event_categories
drop constraint if exists event_categories_options_valid_check;

alter table public.event_categories
add constraint event_categories_options_valid_check check (public.is_valid_event_category_options (options));

drop function if exists public.upsert_calendar_event_category (uuid, text, jsonb);
drop function if exists public.upsert_calendar_event_category (uuid, text, jsonb, text);

create or replace function public.upsert_calendar_event_category (
    target_calendar_id uuid,
    target_name text,
    target_options jsonb default null
) returns uuid language plpgsql security definer
set
    search_path = '' as $$
declare
  trimmed_name text;
  normalized_options jsonb := jsonb_build_object(
    'visibleByDefault',
    true,
    'color',
    public.random_event_category_color()
  );
  result_id uuid;
begin
  if not public.has_calendar_role(target_calendar_id, array['editor', 'manager', 'owner']) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  trimmed_name := nullif(trim(target_name), '');

  if trimmed_name is null then
    raise exception 'Category name is required'
      using errcode = '23514';
  end if;

  if target_options is not null then
    normalized_options := normalized_options || target_options;

    if not public.is_valid_event_category_options(normalized_options) then
      raise exception 'Invalid category options'
        using errcode = '23514';
    end if;
  end if;

  insert into public.event_categories (
    calendar_id,
    name,
    options,
    created_by
  )
  values (
    target_calendar_id,
    trimmed_name,
    normalized_options,
    auth.uid()
  )
  on conflict (calendar_id, (lower(name)))
  do update
    set name = excluded.name,
        options = case
          when target_options is null then public.event_categories.options
          else excluded.options
        end,
        updated_at = now()
  returning id into result_id;

  return result_id;
end;
$$;

grant
execute on function public.upsert_calendar_event_category (uuid, text, jsonb) to authenticated;

drop function if exists public.get_calendar_event_categories (uuid);

create or replace function public.get_calendar_event_categories (target_calendar_id uuid) returns table (
    id uuid,
    calendar_id uuid,
    name text,
    options jsonb,
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
    categories.options,
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

create or replace function public.get_event_categories_json (
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
            'id', categories.id,
            'calendarId', categories.calendar_id,
            'name', categories.name,
            'options', categories.options,
            'createdById', categories.created_by,
            'createdAt', extract(epoch from categories.created_at) * 1000,
            'updatedAt', extract(epoch from categories.updated_at) * 1000
          )
          order by assignments.created_at asc, assignments.id asc
        )
        from public.event_category_assignments as assignments
        join public.event_categories as categories on categories.id = assignments.category_id
        where assignments.event_id = target_event_id
      ),
      '[]'::jsonb
    )
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
    'categories', public.get_event_categories_json(events.id, true),
    'category_id', events.category_id,
    'category_name', primary_category.name,
    'category_options', primary_category.options,
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
    categories jsonb,
    category_id uuid,
    category_name text,
    category_options jsonb,
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
    public.get_event_categories_json(events.id, true),
    events.category_id,
    primary_category.name,
    primary_category.options,
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
    categories jsonb,
    category_id uuid,
    category_name text,
    category_options jsonb,
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
    public.get_event_categories_json(events.id, true),
    events.category_id,
    primary_category.name,
    primary_category.options,
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
