create or replace function public.is_valid_event_category_options (target jsonb) returns boolean language plpgsql immutable
set
    search_path = '' as $$
begin
  if target is null then
    return false;
  end if;

  if jsonb_typeof(target) <> 'object' then
    return false;
  end if;

  if jsonb_typeof(target -> 'visibleByDefault') <> 'boolean' then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;

alter table public.event_categories
add column if not exists options jsonb not null default '{"visibleByDefault": true}'::jsonb;

update public.event_categories
set options = '{"visibleByDefault": true}'::jsonb
where options is null;

alter table public.event_categories
drop constraint if exists event_categories_options_valid_check;

alter table public.event_categories
add constraint event_categories_options_valid_check check (public.is_valid_event_category_options (options));

alter table public.events
drop constraint if exists events_category_id_fkey;

alter table public.events
add constraint events_category_id_fkey foreign key (category_id) references public.event_categories (id) on delete set null;

drop function if exists public.upsert_calendar_event_category (uuid, text);

drop function if exists public.upsert_calendar_event_category (uuid, text, jsonb);

create or replace function public.upsert_calendar_event_category (
    target_calendar_id uuid,
    target_name text,
    target_options jsonb default null
) returns uuid language plpgsql security definer
set
    search_path = '' as $$
declare
  trimmed_name text;
  normalized_options jsonb := jsonb_build_object('visibleByDefault', true);
  result_id uuid;
begin
  if not public.has_calendar_role(target_calendar_id, array['editor', 'manager', 'owner']) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  trimmed_name := nullif(trim(target_name), '');

  if trimmed_name is null then
    raise exception 'Category name is required'
      using errcode = '23514';
  end if;

  if target_options is not null then
    normalized_options := normalized_options || target_options;

    if not public.is_valid_event_category_options(normalized_options) then
      raise exception 'Invalid category options'
        using errcode = '23514';
    end if;
  end if;

  insert into public.event_categories (
    calendar_id,
    name,
    options,
    created_by
  )
  values (
    target_calendar_id,
    trimmed_name,
    normalized_options,
    auth.uid()
  )
  on conflict (calendar_id, (lower(name)))
  do update
    set name = excluded.name,
        options = case
          when target_options is null then public.event_categories.options
          else excluded.options
        end,
        updated_at = now()
  returning id into result_id;

  return result_id;
end;
$$;

grant
execute on function public.upsert_calendar_event_category (uuid, text, jsonb) to authenticated;

drop function if exists public.get_calendar_event_categories (uuid);

create or replace function public.get_calendar_event_categories (target_calendar_id uuid) returns table (
    id uuid,
    calendar_id uuid,
    name text,
    options jsonb,
    created_by uuid,
    created_at timestamptz,
    updated_at timestamptz
) language plpgsql security definer
set
    search_path = '' as $$
begin
  if not (
    public.is_active_calendar_member(target_calendar_id)
    or public.is_calendar_publicly_viewable(target_calendar_id)
  ) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  return query
  select
    categories.id,
    categories.calendar_id,
    categories.name,
    categories.options,
    categories.created_by,
    categories.created_at,
    categories.updated_at
  from public.event_categories as categories
  where categories.calendar_id = target_calendar_id
  order by lower(categories.name) asc, categories.created_at asc;
end;
$$;

grant
execute on function public.get_calendar_event_categories (uuid) to authenticated,
anon;

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
            'options', categories.options,
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

drop function if exists public.delete_calendar_event_category (uuid);

create or replace function public.delete_calendar_event_category (target_category_id uuid) returns boolean language plpgsql security definer
set
    search_path = '' as $$
declare
  current_category public.event_categories;
begin
  select *
  into current_category
  from public.event_categories as categories
  where categories.id = target_category_id
  for update;

  if not found then
    return false;
  end if;

  if not public.has_calendar_role(current_category.calendar_id, array['editor', 'manager', 'owner']) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  update public.events
  set category_id = null,
      updated_at = now(),
      updated_by = coalesce(auth.uid(), updated_by, created_by)
  where category_id = target_category_id;

  delete from public.event_categories as categories
  where categories.id = target_category_id;

  return found;
end;
$$;

grant
execute on function public.delete_calendar_event_category (uuid) to authenticated;
