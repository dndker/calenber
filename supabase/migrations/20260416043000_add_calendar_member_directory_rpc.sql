create or replace function public.get_calendar_member_directory(
  target_calendar_id uuid
)
returns table (
  id uuid,
  user_id uuid,
  role public.calendar_role,
  status public.calendar_member_status,
  created_at timestamptz,
  email text,
  name text,
  avatar_url text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_active_calendar_member(target_calendar_id) then
    return query
    select
      calendar_members.id,
      calendar_members.user_id,
      calendar_members.role,
      calendar_members.status,
      calendar_members.created_at,
      users.email::text,
      nullif(trim(users.raw_user_meta_data ->> 'name'), '')::text,
      nullif(trim(users.raw_user_meta_data ->> 'avatar_url'), '')::text
    from public.calendar_members as calendar_members
    join auth.users as users on users.id = calendar_members.user_id
    where calendar_members.calendar_id = target_calendar_id
    order by calendar_members.created_at asc;
    return;
  end if;

  return query
  select
    calendar_members.id,
    calendar_members.user_id,
    calendar_members.role,
    calendar_members.status,
    calendar_members.created_at,
    users.email::text,
    nullif(trim(users.raw_user_meta_data ->> 'name'), '')::text,
    nullif(trim(users.raw_user_meta_data ->> 'avatar_url'), '')::text
  from public.calendar_members as calendar_members
  join auth.users as users on users.id = calendar_members.user_id
  where calendar_members.calendar_id = target_calendar_id
    and calendar_members.user_id = auth.uid()
    and calendar_members.status = 'pending'
  order by calendar_members.created_at asc;
end;
$$;

grant execute on function public.get_calendar_member_directory(uuid) to authenticated;
