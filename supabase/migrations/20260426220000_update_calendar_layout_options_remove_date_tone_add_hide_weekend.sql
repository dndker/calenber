create or replace function public.get_default_calendar_layout_options () returns jsonb language sql immutable
set
    search_path = '' as $$
  select jsonb_build_object(
    'version', 1,
    'weekStartsOn', 'sunday',
    'showWeekendTextColors', true,
    'showHolidayBackground', true,
    'hideWeekendColumns', false
  );
$$;

create or replace function public.is_valid_calendar_layout_options (target jsonb) returns boolean language plpgsql immutable
set
    search_path = '' as $$
begin
  if target is null or jsonb_typeof(target) <> 'object' then
    return false;
  end if;

  if coalesce((target ->> 'version')::integer, 0) <> 1 then
    return false;
  end if;

  if (target ->> 'weekStartsOn') not in ('sunday', 'monday') then
    return false;
  end if;

  if jsonb_typeof(target -> 'showWeekendTextColors') <> 'boolean' then
    return false;
  end if;

  if jsonb_typeof(target -> 'showHolidayBackground') <> 'boolean' then
    return false;
  end if;

  if jsonb_typeof(target -> 'hideWeekendColumns') <> 'boolean' then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;

update public.calendars as calendars
set layout_options = jsonb_build_object(
  'version', 1,
  'weekStartsOn', case
    when calendars.layout_options ->> 'weekStartsOn' in ('sunday', 'monday')
      then calendars.layout_options ->> 'weekStartsOn'
    else 'sunday'
  end,
  'showWeekendTextColors', coalesce(
    (calendars.layout_options ->> 'showWeekendTextColors')::boolean,
    true
  ),
  'showHolidayBackground', coalesce(
    (calendars.layout_options ->> 'showHolidayBackground')::boolean,
    true
  ),
  'hideWeekendColumns', coalesce(
    (calendars.layout_options ->> 'hideWeekendColumns')::boolean,
    false
  )
);

alter table public.calendars
drop constraint if exists calendars_layout_options_valid_check;

alter table public.calendars
add constraint calendars_layout_options_valid_check check (public.is_valid_calendar_layout_options(layout_options));
