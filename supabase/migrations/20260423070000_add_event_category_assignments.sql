create table if not exists public.event_category_assignments (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.events (id) on delete cascade,
    category_id uuid not null references public.event_categories (id) on delete cascade,
    created_by uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now(),
    unique (event_id, category_id)
);

create index if not exists event_category_assignments_event_created_idx on public.event_category_assignments (event_id, created_at asc);

create index if not exists event_category_assignments_category_created_idx on public.event_category_assignments (category_id, created_at asc);

alter table public.event_category_assignments enable row level security;

drop policy if exists "members can view event category assignments" on public.event_category_assignments;

create policy "members can view event category assignments" on public.event_category_assignments for
select
    to authenticated using (
        exists (
            select
                1
            from
                public.events as events
            where
                events.id = event_category_assignments.event_id
                and (
                    public.is_active_calendar_member (events.calendar_id)
                    or public.is_calendar_publicly_viewable (events.calendar_id)
                )
        )
    );

drop policy if exists "members can manage event category assignments" on public.event_category_assignments;

create policy "members can manage event category assignments" on public.event_category_assignments for all to authenticated using (
    exists (
        select
            1
        from
            public.events as events
        where
            events.id = event_category_assignments.event_id
            and public.can_update_calendar_event (
                events.calendar_id,
                events.created_by,
                events.is_locked
            )
    )
)
with
    check (
        exists (
            select
                1
            from
                public.events as events
                join public.event_categories as categories on categories.id = event_category_assignments.category_id
                and categories.calendar_id = events.calendar_id
            where
                events.id = event_category_assignments.event_id
                and public.can_update_calendar_event (
                    events.calendar_id,
                    events.created_by,
                    events.is_locked
                )
        )
    );

create or replace function public.set_event_category_assignment_write_metadata () returns trigger language plpgsql
set
    search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_at = coalesce(new.created_at, now());
    new.created_by = coalesce(new.created_by, auth.uid());
  end if;

  return new;
end;
$$;

drop trigger if exists set_event_category_assignment_write_metadata on public.event_category_assignments;

create trigger set_event_category_assignment_write_metadata before insert on public.event_category_assignments for each row
execute function public.set_event_category_assignment_write_metadata ();

insert into public.event_category_assignments (
    event_id,
    category_id,
    created_by,
    created_at
)
select
    events.id,
    events.category_id,
    coalesce(events.updated_by, events.created_by),
    coalesce(events.updated_at, events.created_at, now())
from public.events as events
where events.category_id is not null
on conflict (event_id, category_id) do nothing;

create or replace function public.get_event_categories_json (
    target_event_id uuid,
    include_details boolean default true
) returns jsonb language sql security definer stable
set
    search_path = '' as $$
  select case
    when include_details is not true then '[]'::jsonb
    else coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', categories.id,
            'calendarId', categories.calendar_id,
            'name', categories.name,
            'createdById', categories.created_by,
            'createdAt', extract(epoch from categories.created_at) * 1000,
            'updatedAt', extract(epoch from categories.updated_at) * 1000
          )
          order by assignments.created_at asc, assignments.id asc
        )
        from public.event_category_assignments as assignments
        join public.event_categories as categories on categories.id = assignments.category_id
        where assignments.event_id = target_event_id
      ),
      '[]'::jsonb
    )
  end;
$$;

create or replace function public.replace_calendar_event_categories (target_event_id uuid, target_category_ids uuid[]) returns jsonb language plpgsql security definer
set
    search_path = '' as $$
declare
  current_event public.events;
  normalized_category_ids uuid[] := coalesce(target_category_ids, array[]::uuid[]);
  previous_categories jsonb := '[]'::jsonb;
  next_categories jsonb := '[]'::jsonb;
  next_primary_category_id uuid;
begin
  select *
  into current_event
  from public.events as events
  where events.id = target_event_id
  for update;

  if not found then
    raise exception 'Event not found'
      using errcode = 'P0002';
  end if;

  if not public.can_update_calendar_event(
    current_event.calendar_id,
    current_event.created_by,
    current_event.is_locked
  ) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  normalized_category_ids := array(
    select category_id
    from (
      select distinct on (category_id)
        category_id,
        ordinality
      from unnest(normalized_category_ids) with ordinality as input(category_id, ordinality)
      where category_id is not null
      order by category_id, ordinality
    ) as deduped
    order by deduped.ordinality
  );

  if exists (
    select 1
    from unnest(normalized_category_ids) as category_id
    where not exists (
      select 1
      from public.event_categories as categories
      where categories.id = category_id
        and categories.calendar_id = current_event.calendar_id
    )
  ) then
    raise exception 'All event categories must belong to the same calendar'
      using errcode = '23514';
  end if;

  previous_categories := public.get_event_categories_json(target_event_id, true);

  delete from public.event_category_assignments as assignments
  where assignments.event_id = target_event_id
    and not (assignments.category_id = any(normalized_category_ids));

  insert into public.event_category_assignments (
    event_id,
    category_id,
    created_by
  )
  select
    target_event_id,
    category_id,
    auth.uid()
  from unnest(normalized_category_ids) as category_id
  on conflict (event_id, category_id)
  do nothing;

  next_primary_category_id := normalized_category_ids[1];

  update public.events
  set category_id = next_primary_category_id,
      updated_at = now(),
      updated_by = coalesce(auth.uid(), updated_by, created_by)
  where id = target_event_id;

  next_categories := public.get_event_categories_json(target_event_id, true);

  if previous_categories is distinct from next_categories then
    insert into public.event_history (
      calendar_id,
      event_id,
      action,
      actor_user_id,
      summary,
      changes,
      occurred_at
    )
    values (
      current_event.calendar_id,
      target_event_id,
      'updated',
      auth.uid(),
      '카테고리를 변경했습니다.',
      jsonb_build_array(
        public.build_event_history_change(
          'categories',
          '카테고리',
          previous_categories,
          next_categories
        )
      ),
      now()
    );
  end if;

  return public.build_calendar_event_realtime_record(target_event_id);
end;
$$;

grant
execute on function public.get_event_categories_json (uuid, boolean) to authenticated,
anon;

grant
execute on function public.replace_calendar_event_categories (uuid, uuid[]) to authenticated;

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
    'categories', public.get_event_categories_json(events.id, true),
    'category_id', events.category_id,
    'category_name', primary_category.name,
    'category_created_by', primary_category.created_by,
    'category_created_at', primary_category.created_at,
    'category_updated_at', primary_category.updated_at,
    'recurrence', events.recurrence,
    'exceptions', events.exceptions,
    'participants', public.get_event_participants_json(events.id, true),
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
    categories jsonb,
    category_id uuid,
    category_name text,
    category_created_by uuid,
    category_created_at timestamptz,
    category_updated_at timestamptz,
    recurrence jsonb,
    exceptions jsonb,
    participants jsonb,
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
    public.get_event_categories_json(events.id, true),
    events.category_id,
    primary_category.name,
    primary_category.created_by,
    primary_category.created_at,
    primary_category.updated_at,
    events.recurrence,
    events.exceptions,
    public.get_event_participants_json(events.id, include_participants),
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
    categories jsonb,
    category_id uuid,
    category_name text,
    category_created_by uuid,
    category_created_at timestamptz,
    category_updated_at timestamptz,
    recurrence jsonb,
    exceptions jsonb,
    participants jsonb,
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
    public.get_event_categories_json(events.id, true),
    events.category_id,
    primary_category.name,
    primary_category.created_by,
    primary_category.created_at,
    primary_category.updated_at,
    events.recurrence,
    events.exceptions,
    public.get_event_participants_json(events.id, include_participants),
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
  where events.id = target_event_id;
end;
$$;

grant
execute on function public.get_calendar_event_by_id (uuid) to authenticated,
anon;
