insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'calendar-avatars',
  'calendar-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Avatar uploads are limited to own folder" on storage.objects;
create policy "Avatar uploads are limited to own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Avatar updates are limited to own folder" on storage.objects;
create policy "Avatar updates are limited to own folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Avatar deletes are limited to own folder" on storage.objects;
create policy "Avatar deletes are limited to own folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Calendar avatar uploads are limited to members" on storage.objects;
create policy "Calendar avatar uploads are limited to members"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'calendar-avatars'
  and exists (
    select 1
    from public.calendar_members
    where calendar_id::text = (storage.foldername(name))[1]
      and user_id = auth.uid()
  )
);

drop policy if exists "Calendar avatar updates are limited to members" on storage.objects;
create policy "Calendar avatar updates are limited to members"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'calendar-avatars'
  and exists (
    select 1
    from public.calendar_members
    where calendar_id::text = (storage.foldername(name))[1]
      and user_id = auth.uid()
  )
)
with check (
  bucket_id = 'calendar-avatars'
  and exists (
    select 1
    from public.calendar_members
    where calendar_id::text = (storage.foldername(name))[1]
      and user_id = auth.uid()
  )
);

drop policy if exists "Calendar avatar deletes are limited to members" on storage.objects;
create policy "Calendar avatar deletes are limited to members"
on storage.objects
for delete
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
