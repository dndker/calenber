update public.calendars
set name = concat(
  nullif(trim(auth.users.raw_user_meta_data ->> 'name'), ''),
  '의 캘린더'
)
from auth.users
where public.calendars.created_by = auth.users.id
  and public.calendars.name in ('My Calendar', '내 캘린더')
  and nullif(trim(auth.users.raw_user_meta_data ->> 'name'), '') is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_calendar_id uuid;
  display_name text;
  default_calendar_name text;
begin
  display_name := nullif(trim(new.raw_user_meta_data ->> 'name'), '');
  default_calendar_name := coalesce(
    concat(display_name, '의 캘린더'),
    '내 캘린더'
  );

  insert into public.profiles (user_id)
  values (new.id);

  insert into public.calendars (name, created_by)
  values (default_calendar_name, new.id)
  returning id into new_calendar_id;

  insert into public.calendar_members (user_id, calendar_id, role)
  values (new.id, new_calendar_id, 'owner');

  return new;
end;
$$;
