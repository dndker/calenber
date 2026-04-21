create table if not exists public.event_categories (
    id uuid primary key default gen_random_uuid(),
    calendar_id uuid not null references public.calendars (id) on delete cascade,
    name text not null,
    created_by uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists event_categories_calendar_name_uidx on public.event_categories (calendar_id, lower(name));

create index if not exists event_categories_calendar_updated_idx on public.event_categories (calendar_id, updated_at desc, created_at desc);

alter table public.event_categories enable row level security;

drop policy if exists "members can view event categories" on public.event_categories;

create policy "members can view event categories" on public.event_categories for
select
    to public using (
        public.is_active_calendar_member (calendar_id)
        or public.is_calendar_publicly_viewable (calendar_id)
    );

drop policy if exists "members can manage event categories" on public.event_categories;

create policy "members can manage event categories" on public.event_categories for all to authenticated using (
    public.has_calendar_role (calendar_id, array['editor', 'manager', 'owner'])
)
with
    check (
        public.has_calendar_role (calendar_id, array['editor', 'manager', 'owner'])
    );

create or replace function public.set_event_category_updated_at () returns trigger language plpgsql
set
    search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_at = coalesce(new.created_at, now());
    new.updated_at = coalesce(new.updated_at, new.created_at, now());
    new.created_by = coalesce(new.created_by, auth.uid());
    return new;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_event_category_updated_at on public.event_categories;

create trigger set_event_category_updated_at before insert
or
update on public.event_categories for each row
execute function public.set_event_category_updated_at ();

create or replace function public.is_valid_event_recurrence (target jsonb) returns boolean language plpgsql immutable
set
    search_path = '' as $$
declare
  recurrence_type text;
  interval_value integer;
  weekday_value jsonb;
begin
  if target is null then
    return true;
  end if;

  if jsonb_typeof(target) <> 'object' then
    return false;
  end if;

  recurrence_type := target ->> 'type';

  if recurrence_type not in ('daily', 'weekly', 'monthly', 'yearly') then
    return false;
  end if;

  if jsonb_typeof(target -> 'interval') <> 'number' then
    return false;
  end if;

  interval_value := (target ->> 'interval')::integer;

  if interval_value < 1 then
    return false;
  end if;

  if target ? 'until' and nullif(target ->> 'until', '') is null then
    return false;
  end if;

  if target ? 'count' and ((target ->> 'count')::integer < 1) then
    return false;
  end if;

  if target ? 'until' and target ? 'count' then
    return false;
  end if;

  if target ? 'byWeekday' then
    if jsonb_typeof(target -> 'byWeekday') <> 'array' then
      return false;
    end if;

    if recurrence_type <> 'weekly' then
      return false;
    end if;

    for weekday_value in
      select value
      from jsonb_array_elements(target -> 'byWeekday')
    loop
      if jsonb_typeof(weekday_value) <> 'number' then
        return false;
      end if;

      if (weekday_value #>> '{}')::integer < 0 or (weekday_value #>> '{}')::integer > 6 then
        return false;
      end if;
    end loop;
  elsif recurrence_type = 'weekly' then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;

create or replace function public.is_valid_event_exceptions (target jsonb) returns boolean language plpgsql immutable
set
    search_path = '' as $$
declare
  exception_value jsonb;
begin
  if target is null then
    return true;
  end if;

  if jsonb_typeof(target) <> 'array' then
    return false;
  end if;

  for exception_value in
    select value
    from jsonb_array_elements(target)
  loop
    if jsonb_typeof(exception_value) <> 'string' then
      return false;
    end if;

    perform (exception_value #>> '{}')::timestamptz;
  end loop;

  return true;
exception
  when others then
    return false;
end;
$$;

create or replace function public.event_category_matches_calendar (target_category_id uuid, target_calendar_id uuid) returns boolean language sql stable
set
    search_path = '' as $$
  select
    target_category_id is null
    or exists (
      select 1
      from public.event_categories as categories
      where categories.id = target_category_id
        and categories.calendar_id = target_calendar_id
    );
$$;
