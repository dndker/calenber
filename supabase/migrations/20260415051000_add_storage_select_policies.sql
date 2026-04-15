drop policy if exists "Avatar objects are readable by owner" on storage.objects;
create policy "Avatar objects are readable by owner"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and owner_id = auth.uid()::text
);

drop policy if exists "Calendar avatar objects are readable by members" on storage.objects;
create policy "Calendar avatar objects are readable by members"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'calendar-avatars'
  and exists (
    select 1
    from public.calendar_members
    where calendar_id::text = (storage.foldername(name))[1]
      and user_id = auth.uid()
  )
);
