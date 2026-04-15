-- Make the auth user bootstrap trigger robust on hosted Supabase.
-- The trigger inserts into public tables from an auth schema event,
-- so we use SECURITY DEFINER and schema-qualified names.

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
  values ('My Calendar', new.id)
  returning id into new_calendar_id;

  insert into public.calendar_members (user_id, calendar_id, role)
  values (new.id, new_calendar_id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();
