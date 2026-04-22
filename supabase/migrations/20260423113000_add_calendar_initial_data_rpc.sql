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
