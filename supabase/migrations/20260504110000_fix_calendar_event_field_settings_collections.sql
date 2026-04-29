-- event_field_settings가 category -> collection 리네임 이후에도
-- 레거시 'categories' 값을 검사/기본값으로 유지하던 문제를 정리한다.
-- 최종적으로 calendars.event_field_settings 는 collections만 허용한다.

create or replace function public.get_default_calendar_event_field_settings () returns jsonb language sql immutable
set
    search_path = '' as $$
  select jsonb_build_object(
    'version',
    1,
    'items',
    jsonb_build_array(
      jsonb_build_object('id', 'schedule', 'visible', true),
      jsonb_build_object('id', 'collections', 'visible', true),
      jsonb_build_object('id', 'status', 'visible', false),
      jsonb_build_object('id', 'participants', 'visible', false),
      jsonb_build_object('id', 'recurrence', 'visible', false),
      jsonb_build_object('id', 'exceptions', 'visible', false),
      jsonb_build_object('id', 'timezone', 'visible', false),
      jsonb_build_object('id', 'place', 'visible', false),
      jsonb_build_object('id', 'notification', 'visible', false)
    )
  );
$$;

create or replace function public.is_valid_calendar_event_field_settings (target jsonb) returns boolean language plpgsql immutable
set
    search_path = '' as $$
declare
  item jsonb;
  field_id text;
  seen_ids text[] := array[]::text[];
begin
  if target is null or jsonb_typeof(target) <> 'object' then
    return false;
  end if;

  if coalesce((target ->> 'version')::integer, 0) <> 1 then
    return false;
  end if;

  if jsonb_typeof(target -> 'items') <> 'array' then
    return false;
  end if;

  for item in
    select value
    from jsonb_array_elements(target -> 'items')
  loop
    if jsonb_typeof(item) <> 'object' then
      return false;
    end if;

    if jsonb_typeof(item -> 'id') <> 'string' then
      return false;
    end if;

    if jsonb_typeof(item -> 'visible') <> 'boolean' then
      return false;
    end if;

    field_id := item ->> 'id';

    if field_id not in (
      'schedule',
      'collections',
      'status',
      'participants',
      'recurrence',
      'exceptions',
      'timezone',
      'place',
      'notification'
    ) then
      return false;
    end if;

    if field_id = any(seen_ids) then
      return false;
    end if;

    seen_ids := array_append(seen_ids, field_id);
  end loop;

  return true;
exception
  when others then
    return false;
end;
$$;

update public.calendars as calendars
set event_field_settings = jsonb_build_object(
  'version',
  1,
  'items',
  (
    select jsonb_agg(normalized.item order by normalized.ord)
    from (
      select
        existing_items.ord,
        existing_items.item
      from (
        select
          existing.id,
          existing.ord,
          existing.item,
          row_number() over (
            partition by existing.id
            order by existing.ord
          ) as row_num
        from (
          select
            case
              when item.value ->> 'id' = 'categories' then 'collections'
              else item.value ->> 'id'
            end as id,
            item.ordinality as ord,
            jsonb_build_object(
              'id',
              case
                when item.value ->> 'id' = 'categories' then 'collections'
                else item.value ->> 'id'
              end,
              'visible',
              coalesce((item.value ->> 'visible')::boolean, false)
            ) as item
          from jsonb_array_elements(
            coalesce(calendars.event_field_settings -> 'items', '[]'::jsonb)
          ) with ordinality as item(value, ordinality)
          where item.value ->> 'id' in (
            'schedule',
            'categories',
            'collections',
            'status',
            'participants',
            'recurrence',
            'exceptions',
            'timezone',
            'place',
            'notification'
          )
        ) as existing
      ) as existing_items
      where existing_items.row_num = 1

      union all

      select
        defaults.ord + 1000 as ord,
        jsonb_build_object(
          'id',
          defaults.id,
          'visible',
          defaults.visible
        ) as item
      from (
        values
          (1, 'schedule', true),
          (2, 'collections', true),
          (3, 'status', false),
          (4, 'participants', false),
          (5, 'recurrence', false),
          (6, 'exceptions', false),
          (7, 'timezone', false),
          (8, 'place', false),
          (9, 'notification', false)
      ) as defaults(ord, id, visible)
      where not exists (
        select 1
        from jsonb_array_elements(
          coalesce(calendars.event_field_settings -> 'items', '[]'::jsonb)
        ) as existing_item(value)
        where case
          when existing_item.value ->> 'id' = 'categories' then 'collections'
          else existing_item.value ->> 'id'
        end = defaults.id
      )
    ) as normalized
  )
);

alter table public.calendars
drop constraint if exists calendars_event_field_settings_valid_check;

alter table public.calendars
add constraint calendars_event_field_settings_valid_check check (public.is_valid_calendar_event_field_settings (event_field_settings));
