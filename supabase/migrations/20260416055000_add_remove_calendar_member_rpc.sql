create or replace function public.remove_calendar_member(
  target_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid;
  actor_membership public.calendar_members%rowtype;
  target_membership public.calendar_members%rowtype;
  active_owner_count integer;
begin
  actor_user_id := auth.uid();

  if actor_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select *
  into target_membership
  from public.calendar_members
  where id = target_member_id;

  if target_membership.id is null then
    raise exception 'Member not found'
      using errcode = 'P0002';
  end if;

  select *
  into actor_membership
  from public.calendar_members
  where calendar_id = target_membership.calendar_id
    and user_id = actor_user_id;

  if actor_membership.id is null
     or actor_membership.status <> 'active'
     or actor_membership.role not in ('manager', 'owner') then
    raise exception 'Only active managers or owners can remove members'
      using errcode = '42501';
  end if;

  if target_membership.user_id = actor_user_id then
    raise exception 'Use leave flow to remove your own membership'
      using errcode = '42501';
  end if;

  if actor_membership.role = 'manager'
     and target_membership.role not in ('viewer', 'editor') then
    raise exception 'Managers can remove only viewers or editors'
      using errcode = '42501';
  end if;

  if target_membership.role = 'owner'
     and target_membership.status = 'active' then
    select count(*)
    into active_owner_count
    from public.calendar_members
    where calendar_id = target_membership.calendar_id
      and role = 'owner'
      and status = 'active';

    if active_owner_count < 2 then
      raise exception 'The last owner cannot be removed'
        using errcode = '42501';
    end if;
  end if;

  delete from public.calendar_members
  where id = target_membership.id;
end;
$$;

grant execute on function public.remove_calendar_member(uuid) to authenticated;
