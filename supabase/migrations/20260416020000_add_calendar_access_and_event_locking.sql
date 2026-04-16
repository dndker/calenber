do $$
begin
  create type public.calendar_access_mode as enum (
    'public_open',
    'public_approval',
    'private'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.calendar_member_status as enum ('active', 'pending');
exception
  when duplicate_object then null;
end $$;

alter table public.calendars
add column if not exists access_mode public.calendar_access_mode not null default 'public_open';

alter table public.calendar_members
add column if not exists status public.calendar_member_status not null default 'active';

update public.calendar_members
set status = 'active'
where status is distinct from 'active';

alter table public.events
add column if not exists is_locked boolean not null default false;

update public.events as events
set created_by = calendars.created_by
from public.calendars as calendars
where calendars.id = events.calendar_id
  and events.created_by is null;

create or replace function public.is_active_calendar_member(target_calendar_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.calendar_members
    where calendar_id = target_calendar_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.has_calendar_role(
  target_calendar_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.calendar_members
    where calendar_id = target_calendar_id
      and user_id = auth.uid()
      and status = 'active'
      and role::text = any(allowed_roles)
  );
$$;

create or replace function public.can_update_calendar_event(
  target_calendar_id uuid,
  event_creator uuid,
  locked boolean
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select
    public.has_calendar_role(target_calendar_id, array['manager', 'owner'])
    or (
      public.has_calendar_role(target_calendar_id, array['editor'])
      and (
        locked = false
        or event_creator = auth.uid()
      )
    );
$$;

drop policy if exists "users can view their calendars" on public.calendars;
create policy "users can view their calendars"
on public.calendars
for select
using (public.is_active_calendar_member(id));

drop policy if exists "calendar managers can update calendars" on public.calendars;
create policy "calendar managers can update calendars"
on public.calendars
for update
to authenticated
using (public.has_calendar_role(id, array['manager', 'owner']))
with check (public.has_calendar_role(id, array['manager', 'owner']));

drop policy if exists "users can view members" on public.calendar_members;
create policy "users can view members"
on public.calendar_members
for select
using (
  public.is_active_calendar_member(calendar_id)
  or (user_id = auth.uid() and status = 'pending')
);

drop policy if exists "calendar managers can update members" on public.calendar_members;
create policy "calendar managers can update members"
on public.calendar_members
for update
to authenticated
using (public.has_calendar_role(calendar_id, array['manager', 'owner']))
with check (public.has_calendar_role(calendar_id, array['manager', 'owner']));

drop policy if exists "users can access events" on public.events;

create policy "users can view events"
on public.events
for select
to authenticated
using (public.is_active_calendar_member(calendar_id));

create policy "members can create events"
on public.events
for insert
to authenticated
with check (
  public.has_calendar_role(calendar_id, array['editor', 'manager', 'owner'])
  and created_by = auth.uid()
);

create policy "members can update events"
on public.events
for update
to authenticated
using (public.can_update_calendar_event(calendar_id, created_by, is_locked))
with check (public.can_update_calendar_event(calendar_id, created_by, is_locked));

create policy "members can delete events"
on public.events
for delete
to authenticated
using (public.can_update_calendar_event(calendar_id, created_by, is_locked));

drop policy if exists "Calendar avatar uploads are limited to members" on storage.objects;
create policy "Calendar avatar uploads are limited to managers"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'calendar-avatars'
  and public.has_calendar_role(((storage.foldername(name))[1])::uuid, array['manager', 'owner'])
);

drop policy if exists "Calendar avatar updates are limited to members" on storage.objects;
drop policy if exists "Calendar avatar updates are limited to managers" on storage.objects;
create policy "Calendar avatar updates are limited to managers"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'calendar-avatars'
  and public.has_calendar_role(((storage.foldername(name))[1])::uuid, array['manager', 'owner'])
)
with check (
  bucket_id = 'calendar-avatars'
  and public.has_calendar_role(((storage.foldername(name))[1])::uuid, array['manager', 'owner'])
);

drop policy if exists "Calendar avatar deletes are limited to members" on storage.objects;
drop policy if exists "Calendar avatar deletes are limited to managers" on storage.objects;
create policy "Calendar avatar deletes are limited to managers"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'calendar-avatars'
  and public.has_calendar_role(((storage.foldername(name))[1])::uuid, array['manager', 'owner'])
);

drop policy if exists "Calendar avatar objects are readable by members" on storage.objects;
create policy "Calendar avatar objects are readable by members"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'calendar-avatars'
  and public.is_active_calendar_member(((storage.foldername(name))[1])::uuid)
);
