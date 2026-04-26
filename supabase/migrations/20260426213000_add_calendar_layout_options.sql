create or replace function public.get_default_calendar_layout_options () returns jsonb language sql immutable
set
    search_path = '' as $$
  select jsonb_build_object(
    'version', 1,
    'weekStartsOn', 'sunday',
    'showWeekendTextColors', true,
    'showHolidayBackground', true,
    'dateTone', 'default'
  );
$$;

create or replace function public.is_valid_calendar_layout_options (target jsonb) returns boolean language plpgsql immutable
set
    search_path = '' as $$
begin
  if target is null or jsonb_typeof(target) <> 'object' then
    return false;
  end if;

  if coalesce((target ->> 'version')::integer, 0) <> 1 then
    return false;
  end if;

  if (target ->> 'weekStartsOn') not in ('sunday', 'monday') then
    return false;
  end if;

  if jsonb_typeof(target -> 'showWeekendTextColors') <> 'boolean' then
    return false;
  end if;

  if jsonb_typeof(target -> 'showHolidayBackground') <> 'boolean' then
    return false;
  end if;

  if (target ->> 'dateTone') not in ('default', 'contrast', 'soft') then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;

alter table public.calendars
add column if not exists layout_options jsonb not null default public.get_default_calendar_layout_options ();

update public.calendars
set layout_options = public.get_default_calendar_layout_options ()
where layout_options is null
   or not public.is_valid_calendar_layout_options(layout_options);

alter table public.calendars
drop constraint if exists calendars_layout_options_valid_check;

alter table public.calendars
add constraint calendars_layout_options_valid_check check (public.is_valid_calendar_layout_options(layout_options));

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
          'layoutOptions', calendars.layout_options,
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
              'layoutOptions', calendars.layout_options,
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
  layout_options jsonb,
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
    calendars.layout_options,
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

create or replace function public.build_calendar_settings_realtime_record (target_calendar_id uuid) returns jsonb language sql security definer
set
    search_path = '' as $$
  select jsonb_build_object(
    'id', calendars.id,
    'event_field_settings', calendars.event_field_settings,
    'layout_options', calendars.layout_options,
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
  if old.event_field_settings is not distinct from new.event_field_settings
     and old.layout_options is not distinct from new.layout_options then
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
after update of event_field_settings, layout_options on public.calendars
for each row
execute function public.broadcast_calendar_settings_change();
