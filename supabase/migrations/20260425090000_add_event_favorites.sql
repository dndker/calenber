create table if not exists public.event_favorites (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.events (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (event_id, user_id)
);

create index if not exists event_favorites_user_created_idx on public.event_favorites (user_id, created_at desc, event_id);

alter table public.event_favorites enable row level security;

drop policy if exists "members can view own event favorites" on public.event_favorites;

create policy "members can view own event favorites" on public.event_favorites for
select
    to authenticated using (
        user_id = auth.uid()
        and exists (
            select
                1
            from
                public.events as events
            where
                events.id = event_favorites.event_id
                and public.is_active_calendar_member(events.calendar_id)
        )
    );

drop policy if exists "members can manage own event favorites" on public.event_favorites;

create policy "members can manage own event favorites" on public.event_favorites for all to authenticated using (
    user_id = auth.uid()
    and exists (
        select
            1
        from
            public.events as events
        where
            events.id = event_favorites.event_id
            and public.is_active_calendar_member(events.calendar_id)
    )
)
with
    check (
        user_id = auth.uid()
        and exists (
            select
                1
            from
                public.events as events
            where
                events.id = event_favorites.event_id
                and public.is_active_calendar_member(events.calendar_id)
        )
    );

create or replace function public.set_event_favorite_write_metadata () returns trigger language plpgsql
set
    search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_at = coalesce(new.created_at, now());
    new.user_id = coalesce(new.user_id, auth.uid());
  end if;

  return new;
end;
$$;

drop trigger if exists set_event_favorite_write_metadata on public.event_favorites;

create trigger set_event_favorite_write_metadata before insert on public.event_favorites for each row
execute function public.set_event_favorite_write_metadata ();

create or replace function public.build_calendar_event_realtime_record (target_event_id uuid) returns jsonb language sql security definer
set
    search_path = '' as $$
  select jsonb_build_object(
    'id', events.id,
    'calendar_id', events.calendar_id,
    'title', events.title,
    'content', events.content,
    'start_at', events.start_at,
    'end_at', events.end_at,
    'all_day', events.all_day,
    'timezone', events.timezone,
    'categories', public.get_event_categories_json(events.id, true),
    'category_id', events.category_id,
    'category_name', primary_category.name,
    'category_created_by', primary_category.created_by,
    'category_created_at', primary_category.created_at,
    'category_updated_at', primary_category.updated_at,
    'recurrence', events.recurrence,
    'exceptions', events.exceptions,
    'participants', public.get_event_participants_json(events.id, true),
    'is_favorite', coalesce(event_favorites.id is not null, false),
    'favorited_at', event_favorites.created_at,
    'status', events.status,
    'created_by', events.created_by,
    'updated_by', events.updated_by,
    'is_locked', events.is_locked,
    'created_at', events.created_at,
    'updated_at', events.updated_at,
    'creator_name', nullif(trim(creators.raw_user_meta_data ->> 'name'), '')::text,
    'creator_email', creators.email::text,
    'creator_avatar_url', nullif(trim(creators.raw_user_meta_data ->> 'avatar_url'), '')::text,
    'updater_name', nullif(trim(updaters.raw_user_meta_data ->> 'name'), '')::text,
    'updater_email', updaters.email::text,
    'updater_avatar_url', nullif(trim(updaters.raw_user_meta_data ->> 'avatar_url'), '')::text
  )
  from public.events as events
  left join public.event_categories as primary_category on primary_category.id = events.category_id
  left join auth.users as creators on creators.id = events.created_by
  left join auth.users as updaters on updaters.id = events.updated_by
  left join public.event_favorites as event_favorites
    on event_favorites.event_id = events.id
    and event_favorites.user_id = auth.uid()
  where events.id = target_event_id;
$$;

drop function if exists public.get_calendar_events_with_authors (uuid);

create or replace function public.get_calendar_events_with_authors (target_calendar_id uuid) returns table (
    id uuid,
    calendar_id uuid,
    title text,
    content jsonb,
    start_at timestamptz,
    end_at timestamptz,
    all_day boolean,
    timezone text,
    categories jsonb,
    category_id uuid,
    category_name text,
    category_created_by uuid,
    category_created_at timestamptz,
    category_updated_at timestamptz,
    recurrence jsonb,
    exceptions jsonb,
    participants jsonb,
    is_favorite boolean,
    favorited_at timestamptz,
    status public.calendar_event_status,
    created_by uuid,
    updated_by uuid,
    is_locked boolean,
    created_at timestamptz,
    updated_at timestamptz,
    creator_name text,
    creator_email text,
    creator_avatar_url text,
    updater_name text,
    updater_email text,
    updater_avatar_url text
) language plpgsql security definer
set
    search_path = '' as $$
declare
  include_participants boolean;
begin
  if not (
    public.is_active_calendar_member(target_calendar_id)
    or public.is_calendar_publicly_viewable(target_calendar_id)
  ) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  include_participants := public.is_active_calendar_member(target_calendar_id);

  return query
  select
    events.id,
    events.calendar_id,
    events.title,
    events.content,
    events.start_at,
    events.end_at,
    events.all_day,
    events.timezone,
    public.get_event_categories_json(events.id, true),
    events.category_id,
    primary_category.name,
    primary_category.created_by,
    primary_category.created_at,
    primary_category.updated_at,
    events.recurrence,
    events.exceptions,
    public.get_event_participants_json(events.id, include_participants),
    coalesce(event_favorites.id is not null, false),
    event_favorites.created_at,
    events.status,
    events.created_by,
    events.updated_by,
    events.is_locked,
    events.created_at,
    events.updated_at,
    nullif(trim(creators.raw_user_meta_data ->> 'name'), '')::text,
    creators.email::text,
    nullif(trim(creators.raw_user_meta_data ->> 'avatar_url'), '')::text,
    nullif(trim(updaters.raw_user_meta_data ->> 'name'), '')::text,
    updaters.email::text,
    nullif(trim(updaters.raw_user_meta_data ->> 'avatar_url'), '')::text
  from public.events as events
  left join public.event_categories as primary_category on primary_category.id = events.category_id
  left join auth.users as creators on creators.id = events.created_by
  left join auth.users as updaters on updaters.id = events.updated_by
  left join public.event_favorites as event_favorites
    on event_favorites.event_id = events.id
    and event_favorites.user_id = auth.uid()
  where events.calendar_id = target_calendar_id
  order by events.start_at asc, events.created_at asc;
end;
$$;

grant
execute on function public.get_calendar_events_with_authors (uuid) to authenticated,
anon;

drop function if exists public.get_calendar_event_by_id (uuid);

create or replace function public.get_calendar_event_by_id (target_event_id uuid) returns table (
    id uuid,
    calendar_id uuid,
    title text,
    content jsonb,
    start_at timestamptz,
    end_at timestamptz,
    all_day boolean,
    timezone text,
    categories jsonb,
    category_id uuid,
    category_name text,
    category_created_by uuid,
    category_created_at timestamptz,
    category_updated_at timestamptz,
    recurrence jsonb,
    exceptions jsonb,
    participants jsonb,
    is_favorite boolean,
    favorited_at timestamptz,
    status public.calendar_event_status,
    created_by uuid,
    updated_by uuid,
    is_locked boolean,
    created_at timestamptz,
    updated_at timestamptz,
    creator_name text,
    creator_email text,
    creator_avatar_url text,
    updater_name text,
    updater_email text,
    updater_avatar_url text
) language plpgsql security definer
set
    search_path = '' as $$
declare
  resolved_calendar_id uuid;
  include_participants boolean;
begin
  select events.calendar_id
  into resolved_calendar_id
  from public.events as events
  where events.id = target_event_id;

  if not (
    public.is_active_calendar_member(resolved_calendar_id)
    or public.is_calendar_publicly_viewable(resolved_calendar_id)
  ) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  include_participants := public.is_active_calendar_member(resolved_calendar_id);

  return query
  select
    events.id,
    events.calendar_id,
    events.title,
    events.content,
    events.start_at,
    events.end_at,
    events.all_day,
    events.timezone,
    public.get_event_categories_json(events.id, true),
    events.category_id,
    primary_category.name,
    primary_category.created_by,
    primary_category.created_at,
    primary_category.updated_at,
    events.recurrence,
    events.exceptions,
    public.get_event_participants_json(events.id, include_participants),
    coalesce(event_favorites.id is not null, false),
    event_favorites.created_at,
    events.status,
    events.created_by,
    events.updated_by,
    events.is_locked,
    events.created_at,
    events.updated_at,
    nullif(trim(creators.raw_user_meta_data ->> 'name'), '')::text,
    creators.email::text,
    nullif(trim(creators.raw_user_meta_data ->> 'avatar_url'), '')::text,
    nullif(trim(updaters.raw_user_meta_data ->> 'name'), '')::text,
    updaters.email::text,
    nullif(trim(updaters.raw_user_meta_data ->> 'avatar_url'), '')::text
  from public.events as events
  left join public.event_categories as primary_category on primary_category.id = events.category_id
  left join auth.users as creators on creators.id = events.created_by
  left join auth.users as updaters on updaters.id = events.updated_by
  left join public.event_favorites as event_favorites
    on event_favorites.event_id = events.id
    and event_favorites.user_id = auth.uid()
  where events.id = target_event_id;
end;
$$;

grant
execute on function public.get_calendar_event_by_id (uuid) to authenticated,
anon;

drop function if exists public.get_favorite_calendar_events (uuid);

create or replace function public.get_favorite_calendar_events (target_calendar_id uuid default null) returns table (
    id uuid,
    calendar_id uuid,
    title text,
    content jsonb,
    start_at timestamptz,
    end_at timestamptz,
    all_day boolean,
    timezone text,
    categories jsonb,
    category_id uuid,
    category_name text,
    category_created_by uuid,
    category_created_at timestamptz,
    category_updated_at timestamptz,
    recurrence jsonb,
    exceptions jsonb,
    participants jsonb,
    is_favorite boolean,
    favorited_at timestamptz,
    status public.calendar_event_status,
    created_by uuid,
    updated_by uuid,
    is_locked boolean,
    created_at timestamptz,
    updated_at timestamptz,
    creator_name text,
    creator_email text,
    creator_avatar_url text,
    updater_name text,
    updater_email text,
    updater_avatar_url text
) language plpgsql security definer stable
set
    search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if target_calendar_id is not null
    and not public.is_active_calendar_member(target_calendar_id) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  return query
  select
    events.id,
    events.calendar_id,
    events.title,
    events.content,
    events.start_at,
    events.end_at,
    events.all_day,
    events.timezone,
    public.get_event_categories_json(events.id, true),
    events.category_id,
    primary_category.name,
    primary_category.created_by,
    primary_category.created_at,
    primary_category.updated_at,
    events.recurrence,
    events.exceptions,
    public.get_event_participants_json(events.id, true),
    true,
    favorites.created_at,
    events.status,
    events.created_by,
    events.updated_by,
    events.is_locked,
    events.created_at,
    events.updated_at,
    nullif(trim(creators.raw_user_meta_data ->> 'name'), '')::text,
    creators.email::text,
    nullif(trim(creators.raw_user_meta_data ->> 'avatar_url'), '')::text,
    nullif(trim(updaters.raw_user_meta_data ->> 'name'), '')::text,
    updaters.email::text,
    nullif(trim(updaters.raw_user_meta_data ->> 'avatar_url'), '')::text
  from public.event_favorites as favorites
  join public.events as events on events.id = favorites.event_id
  left join public.event_categories as primary_category on primary_category.id = events.category_id
  left join auth.users as creators on creators.id = events.created_by
  left join auth.users as updaters on updaters.id = events.updated_by
  where favorites.user_id = auth.uid()
    and (target_calendar_id is null or events.calendar_id = target_calendar_id)
    and exists (
      select
        1
      from
        public.calendar_members as members
      where
        members.calendar_id = events.calendar_id
        and members.user_id = auth.uid()
        and members.status = 'active'
    )
  order by favorites.created_at desc, events.start_at asc nulls last, events.created_at asc;
end;
$$;

grant
execute on function public.get_favorite_calendar_events (uuid) to authenticated;
