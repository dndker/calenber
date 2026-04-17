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
  calendar_creator_id uuid;
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

  select calendars.created_by
  into calendar_creator_id
  from public.calendars as calendars
  where calendars.id = target_calendar_id;

  if calendar_creator_id is null then
    raise exception 'Calendar not found'
      using errcode = 'P0002';
  end if;

  if calendar_creator_id <> current_user_id
    and (current_role <> 'owner' or current_status <> 'active') then
    raise exception 'Only active owners can delete this calendar'
      using errcode = '42501';
  end if;

  select count(*)
  into owned_calendar_count
  from public.calendar_members as calendar_members
  join public.calendars as calendars
    on calendars.id = calendar_members.calendar_id
  where calendar_members.user_id = current_user_id
    and calendar_members.role = 'owner'
    and calendar_members.status = 'active'
    and calendars.created_by = current_user_id;

  if owned_calendar_count < 2 then
    raise exception 'You must keep at least one owned calendar'
      using errcode = '42501';
  end if;

  delete from public.calendars
  where id = target_calendar_id;
end;
$$;

grant execute on function public.delete_owned_calendar(uuid) to authenticated;
