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
declare
  target_calendar_id uuid;
begin
  -- calendar_id 조회
  select calendar_id into target_calendar_id
  from public.events
  where id = target_event_id;

  if target_calendar_id is null then
    return;
  end if;

  -- 권한 체크 (기존과 동일)
  if not (
    public.is_active_calendar_member(target_calendar_id)
    or public.is_calendar_publicly_viewable(target_calendar_id)
  ) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  -- 기존 RPC와 동일한 형태로 반환
  return query
  select
    events.id,
    events.title,
    events.content,
    events.start_at,
    events.end_at,
    events.status,
    events.created_by,
    events.is_locked,
    events.created_at,
    events.updated_at,
    nullif(trim(users.raw_user_meta_data ->> 'name'), '')::text,
    users.email::text,
    nullif(trim(users.raw_user_meta_data ->> 'avatar_url'), '')::text
  from public.events as events
  left join auth.users as users on users.id = events.created_by
  where events.id = target_event_id;
end;
$$;

grant
execute on function public.get_calendar_event_by_id (uuid) to authenticated,
anon;
