create or replace function public.delete_current_user_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  delete from auth.users
  where id = current_user_id;
end;
$$;

grant execute on function public.delete_current_user_account() to authenticated;
