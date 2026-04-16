create or replace function public.join_public_calendar(
  target_calendar_id uuid
)
returns table (
  role public.calendar_role,
  status public.calendar_member_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  target_access_mode public.calendar_access_mode;
  existing_role public.calendar_role;
  existing_status public.calendar_member_status;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select calendars.access_mode
  into target_access_mode
  from public.calendars as calendars
  where calendars.id = target_calendar_id;

  if target_access_mode is null then
    raise exception 'Calendar not found'
      using errcode = 'P0002';
  end if;

  if target_access_mode = 'private' then
    raise exception 'Private calendars require an invite'
      using errcode = '42501';
  end if;

  select calendar_members.role, calendar_members.status
  into existing_role, existing_status
  from public.calendar_members as calendar_members
  where calendar_members.calendar_id = target_calendar_id
    and calendar_members.user_id = current_user_id;

  if existing_status is not null then
    return query
    select existing_role, existing_status;
    return;
  end if;

  return query
  insert into public.calendar_members (user_id, calendar_id, role, status)
  values (
    current_user_id,
    target_calendar_id,
    'editor',
    case
      when target_access_mode = 'public_open' then 'active'::public.calendar_member_status
      else 'pending'::public.calendar_member_status
    end
  )
  returning calendar_members.role, calendar_members.status;
end;
$$;

grant execute on function public.join_public_calendar(uuid) to authenticated;
