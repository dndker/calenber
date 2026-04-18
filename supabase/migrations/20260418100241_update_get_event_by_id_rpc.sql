drop function if exists public.get_calendar_event_by_id (uuid);

create or replace function public.get_calendar_event_by_id (target_event_id uuid) returns table (
    id uuid,
    title text,
    content jsonb,
    start_at timestamptz,
    end_at timestamptz,
    status public.calendar_event_status,
    created_by uuid,
    is_locked boolean,
    created_at timestamptz,
    updated_at timestamptz,
    creator_name text,
    creator_email text,
    creator_avatar_url text
) language plpgsql security definer
set
    search_path = '' as $$
begin
  -- 권한 체크 (event → calendar_id로 검사)
  if not (
    public.is_active_calendar_member(
      (select e.calendar_id from public.events e where e.id = target_event_id)
    )
    or public.is_calendar_publicly_viewable(
      (select e.calendar_id from public.events e where e.id = target_event_id)
    )
  ) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  return query
  select
    e.id,
    e.title,
    e.content,
    e.start_at,
    e.end_at,
    e.status,
    e.created_by,
    e.is_locked,
    e.created_at,
    e.updated_at,
    nullif(trim(u.raw_user_meta_data ->> 'name'), '')::text,
    u.email::text,
    nullif(trim(u.raw_user_meta_data ->> 'avatar_url'), '')::text
  from public.events e
  left join auth.users u on u.id = e.created_by
  where e.id = target_event_id;
end;
$$;

grant
execute on function public.get_calendar_event_by_id (uuid) to authenticated,
anon;
