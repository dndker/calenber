create or replace function public.get_discover_calendars()
returns table (
  id uuid,
  name text,
  avatar_url text,
  access_mode public.calendar_access_mode,
  event_layout text,
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
