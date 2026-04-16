update public.calendars
set name = '내 캘린더'
where name = 'My Calendar';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_calendar_id uuid;
begin
  insert into public.profiles (user_id)
  values (new.id);

  insert into public.calendars (name, created_by)
  values ('내 캘린더', new.id)
  returning id into new_calendar_id;

  insert into public.calendar_members (user_id, calendar_id, role)
  values (new.id, new_calendar_id, 'owner');

  return new;
end;
$$;
