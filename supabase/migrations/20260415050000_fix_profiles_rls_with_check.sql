drop policy if exists "users can access own profile" on public.profiles;

create policy "users can access own profile"
on public.profiles
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
