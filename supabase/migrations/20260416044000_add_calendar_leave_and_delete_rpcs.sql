create or replace function public.leave_calendar(
  target_calendar_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  current_role public.calendar_role;
  current_status public.calendar_member_status;
  active_owner_count integer;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select calendar_members.role, calendar_members.status
  into current_role, current_status
  from public.calendar_members as calendar_members
  where calendar_members.calendar_id = target_calendar_id
    and calendar_members.user_id = current_user_id;

  if current_status is null or current_status <> 'active' then
    raise exception 'Active membership required'
      using errcode = '42501';
  end if;

  if current_role = 'owner' then
    select count(*)
    into active_owner_count
    from public.calendar_members as calendar_members
    where calendar_members.calendar_id = target_calendar_id
      and calendar_members.role = 'owner'
      and calendar_members.status = 'active';

    if active_owner_count < 2 then
      raise exception 'The last owner cannot leave the calendar'
        using errcode = '42501';
    end if;
  end if;

  delete from public.calendar_members
  where calendar_id = target_calendar_id
    and user_id = current_user_id;
end;
$$;

grant execute on function public.leave_calendar(uuid) to authenticated;

create or replace function public.delete_owned_calendar(
  target_calendar_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  current_role public.calendar_role;
  current_status public.calendar_member_status;
  owned_calendar_count integer;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select calendar_members.role, calendar_members.status
  into current_role, current_status
  from public.calendar_members as calendar_members
  where calendar_members.calendar_id = target_calendar_id
    and calendar_members.user_id = current_user_id;

  if current_role <> 'owner' or current_status <> 'active' then
    raise exception 'Only active owners can delete this calendar'
      using errcode = '42501';
  end if;

  select count(*)
  into owned_calendar_count
  from public.calendar_members as calendar_members
  where calendar_members.user_id = current_user_id
    and calendar_members.role = 'owner'
    and calendar_members.status = 'active';

  if owned_calendar_count < 2 then
    raise exception 'You must keep at least one owned calendar'
      using errcode = '42501';
  end if;

  delete from public.calendars
  where id = target_calendar_id;
end;
$$;

grant execute on function public.delete_owned_calendar(uuid) to authenticated;
