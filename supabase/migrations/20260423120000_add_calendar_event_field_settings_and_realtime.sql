create or replace function public.get_default_calendar_event_field_settings () returns jsonb language sql immutable
set
    search_path = '' as $$
  select jsonb_build_object(
    'version',
    1,
    'items',
    jsonb_build_array(
      jsonb_build_object('id', 'schedule', 'visible', true),
      jsonb_build_object('id', 'participants', 'visible', false),
      jsonb_build_object('id', 'categories', 'visible', true),
      jsonb_build_object('id', 'status', 'visible', false),
      jsonb_build_object('id', 'recurrence', 'visible', false),
      jsonb_build_object('id', 'exceptions', 'visible', false),
      jsonb_build_object('id', 'timezone', 'visible', false),
      jsonb_build_object('id', 'place', 'visible', false),
      jsonb_build_object('id', 'notification', 'visible', false)
    )
  );
$$;

create or replace function public.is_valid_calendar_event_field_settings (target jsonb) returns boolean language plpgsql immutable
set
    search_path = '' as $$
declare
  item jsonb;
  field_id text;
  seen_ids text[] := array[]::text[];
begin
  if target is null or jsonb_typeof(target) <> 'object' then
    return false;
  end if;

  if coalesce((target ->> 'version')::integer, 0) <> 1 then
    return false;
  end if;

  if jsonb_typeof(target -> 'items') <> 'array' then
    return false;
  end if;

  for item in
    select value
    from jsonb_array_elements(target -> 'items')
  loop
    if jsonb_typeof(item) <> 'object' then
      return false;
    end if;

    if jsonb_typeof(item -> 'id') <> 'string' then
      return false;
    end if;

    if jsonb_typeof(item -> 'visible') <> 'boolean' then
      return false;
    end if;

    field_id := item ->> 'id';

    if field_id not in (
      'schedule',
      'participants',
      'categories',
      'status',
      'recurrence',
      'exceptions',
      'timezone',
      'place',
      'notification'
    ) then
      return false;
    end if;

    if field_id = any(seen_ids) then
      return false;
    end if;

    seen_ids := array_append(seen_ids, field_id);
  end loop;

  return true;
exception
  when others then
    return false;
end;
$$;

alter table public.calendars
add column if not exists event_field_settings jsonb not null default public.get_default_calendar_event_field_settings ();

update public.calendars
set event_field_settings = public.get_default_calendar_event_field_settings ()
where event_field_settings is distinct from public.get_default_calendar_event_field_settings ();

alter table public.calendars
drop constraint if exists calendars_event_field_settings_valid_check;

alter table public.calendars
add constraint calendars_event_field_settings_valid_check check (public.is_valid_calendar_event_field_settings (event_field_settings));

drop function if exists public.get_calendar_initial_data(uuid);

create or replace function public.get_calendar_initial_data(
  target_calendar_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  has_access boolean;
  membership_row public.calendar_members;
begin
  has_access := public.is_active_calendar_member(target_calendar_id)
    or public.is_calendar_publicly_viewable(target_calendar_id);

  if auth.uid() is not null then
    select *
    into membership_row
    from public.calendar_members as members
    where members.calendar_id = target_calendar_id
      and members.user_id = auth.uid()
    limit 1;
  end if;

  return jsonb_build_object(
    'calendar',
    case
      when has_access then (
        select jsonb_build_object(
          'id', calendars.id,
          'name', calendars.name,
          'avatarUrl', calendars.avatar_url,
          'accessMode', calendars.access_mode,
          'eventLayout', calendars.event_layout,
          'eventFieldSettings', calendars.event_field_settings,
          'updatedAt', calendars.updated_at,
          'createdAt', calendars.created_at
        )
        from public.calendars as calendars
        where calendars.id = target_calendar_id
      )
      else null
    end,
    'membership',
    jsonb_build_object(
      'isMember', coalesce(membership_row.status = 'active', false),
      'role', membership_row.role,
      'status', membership_row.status
    ),
    'myCalendars',
    case
      when auth.uid() is null then '[]'::jsonb
      else coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', calendars.id,
              'name', calendars.name,
              'avatarUrl', calendars.avatar_url,
              'accessMode', calendars.access_mode,
              'eventLayout', calendars.event_layout,
              'eventFieldSettings', calendars.event_field_settings,
              'updatedAt', calendars.updated_at,
              'createdAt', calendars.created_at,
              'role', members.role
            )
            order by calendars.updated_at desc, calendars.created_at asc
          )
          from public.calendars as calendars
          join public.calendar_members as members
            on members.calendar_id = calendars.id
          where members.user_id = auth.uid()
            and members.status = 'active'
        ),
        '[]'::jsonb
      )
    end,
    'eventCategories',
    case
      when has_access then coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', categories.id,
              'calendarId', categories.calendar_id,
              'name', categories.name,
              'options', categories.options,
              'createdById', categories.created_by,
              'createdAt', categories.created_at,
              'updatedAt', categories.updated_at
            )
            order by lower(categories.name) asc, categories.created_at asc
          )
          from public.event_categories as categories
          where categories.calendar_id = target_calendar_id
        ),
        '[]'::jsonb
      )
      else '[]'::jsonb
    end,
    'events',
    case
      when has_access then coalesce(
        (
          select jsonb_agg(to_jsonb(events))
          from public.get_calendar_events_with_authors(target_calendar_id) as events
        ),
        '[]'::jsonb
      )
      else '[]'::jsonb
    end
  );
end;
$$;

grant execute on function public.get_calendar_initial_data(uuid) to authenticated, anon;

drop function if exists public.get_discover_calendars();

create or replace function public.get_discover_calendars()
returns table (
  id uuid,
  name text,
  avatar_url text,
  access_mode public.calendar_access_mode,
  event_layout text,
  event_field_settings jsonb,
  updated_at timestamptz,
  created_at timestamptz,
  member_count bigint,
  creator_user_id uuid,
  creator_name text,
  creator_email text,
  creator_avatar_url text
)
language sql
security definer
set search_path = ''
as $$
  with active_member_counts as (
    select
      calendar_members.calendar_id,
      count(*)::bigint as member_count
    from public.calendar_members as calendar_members
    where calendar_members.status = 'active'
    group by calendar_members.calendar_id
  )
  select
    calendars.id,
    calendars.name,
    calendars.avatar_url,
    calendars.access_mode,
    calendars.event_layout,
    calendars.event_field_settings,
    calendars.updated_at,
    calendars.created_at,
    coalesce(active_member_counts.member_count, 0) as member_count,
    coalesce(created_user.user_id, fallback_owner.user_id) as creator_user_id,
    coalesce(created_user.name, fallback_owner.name) as creator_name,
    coalesce(created_user.email, fallback_owner.email) as creator_email,
    coalesce(created_user.avatar_url, fallback_owner.avatar_url) as creator_avatar_url
  from public.calendars as calendars
  left join active_member_counts
    on active_member_counts.calendar_id = calendars.id
  left join lateral (
    select
      users.id as user_id,
      nullif(trim(users.raw_user_meta_data ->> 'name'), '')::text as name,
      users.email::text as email,
      nullif(trim(users.raw_user_meta_data ->> 'avatar_url'), '')::text as avatar_url
    from auth.users as users
    where users.id = calendars.created_by
    limit 1
  ) as created_user on true
  left join lateral (
    select
      users.id as user_id,
      nullif(trim(users.raw_user_meta_data ->> 'name'), '')::text as name,
      users.email::text as email,
      nullif(trim(users.raw_user_meta_data ->> 'avatar_url'), '')::text as avatar_url
    from public.calendar_members as calendar_members
    join auth.users as users on users.id = calendar_members.user_id
    where calendar_members.calendar_id = calendars.id
      and calendar_members.role = 'owner'
      and calendar_members.status = 'active'
      and not exists (
        select 1
        from auth.users as created_users
        where created_users.id = calendars.created_by
      )
    order by calendar_members.created_at asc
    limit 1
  ) as fallback_owner on true
  where calendars.access_mode in ('public_open', 'public_approval')
  order by
    coalesce(active_member_counts.member_count, 0) desc,
    calendars.created_at asc,
    calendars.updated_at desc;
$$;

grant execute on function public.get_discover_calendars() to anon, authenticated;

create or replace function public.build_calendar_event_category_realtime_record (target_category_id uuid) returns jsonb language sql security definer
set
    search_path = '' as $$
  select jsonb_build_object(
    'id', categories.id,
    'calendar_id', categories.calendar_id,
    'name', categories.name,
    'options', categories.options,
    'created_by', categories.created_by,
    'created_at', categories.created_at,
    'updated_at', categories.updated_at
  )
  from public.event_categories as categories
  where categories.id = target_category_id;
$$;

create or replace function public.broadcast_calendar_event_category_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_calendar_id uuid := coalesce(new.calendar_id, old.calendar_id);
  target_category_id uuid := coalesce(new.id, old.id);
  target_topic text := public.get_calendar_workspace_topic(target_calendar_id);
  target_is_private boolean := public.is_calendar_workspace_topic_private(target_calendar_id);
  target_event_name text;
  target_payload jsonb;
begin
  target_event_name := case tg_op
    when 'INSERT' then 'calendar.event-category.created'
    when 'UPDATE' then 'calendar.event-category.updated'
    when 'DELETE' then 'calendar.event-category.deleted'
    else 'calendar.event-category.changed'
  end;

  target_payload := jsonb_build_object(
    'entity', 'event_category',
    'operation', lower(tg_op),
    'calendarId', target_calendar_id,
    'categoryId', target_category_id,
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
      public.build_calendar_event_category_realtime_record(target_category_id)
    );
  end if;

  perform realtime.send(
    target_payload,
    target_event_name,
    target_topic,
    target_is_private
  );

  return null;
end;
$$;

drop trigger if exists broadcast_calendar_event_category_change on public.event_categories;

create trigger broadcast_calendar_event_category_change
after insert or update or delete on public.event_categories
for each row
execute function public.broadcast_calendar_event_category_change();

create or replace function public.build_calendar_settings_realtime_record (target_calendar_id uuid) returns jsonb language sql security definer
set
    search_path = '' as $$
  select jsonb_build_object(
    'id', calendars.id,
    'event_field_settings', calendars.event_field_settings,
    'updated_at', calendars.updated_at
  )
  from public.calendars as calendars
  where calendars.id = target_calendar_id;
$$;

create or replace function public.broadcast_calendar_settings_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_topic text := public.get_calendar_workspace_topic(new.id);
  target_is_private boolean := public.is_calendar_workspace_topic_private(new.id);
begin
  if old.event_field_settings is not distinct from new.event_field_settings then
    return null;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'entity', 'calendar_settings',
      'operation', 'update',
      'calendarId', new.id,
      'occurredAt', timezone('utc', now()),
      'record', public.build_calendar_settings_realtime_record(new.id)
    ),
    'calendar.settings.updated',
    target_topic,
    target_is_private
  );

  return null;
end;
$$;

drop trigger if exists broadcast_calendar_settings_change on public.calendars;

create trigger broadcast_calendar_settings_change
after update of event_field_settings on public.calendars
for each row
execute function public.broadcast_calendar_settings_change();
