drop policy if exists "calendar managers can update members" on public.calendar_members;

create policy "calendar managers can update members"
on public.calendar_members
for update
to authenticated
using (
  exists (
    select 1
    from public.calendar_members as actor
    where actor.calendar_id = calendar_members.calendar_id
      and actor.user_id = auth.uid()
      and actor.role in ('manager', 'owner')
  )
)
with check (
  exists (
    select 1
    from public.calendar_members as actor
    where actor.calendar_id = calendar_members.calendar_id
      and actor.user_id = auth.uid()
      and actor.role in ('manager', 'owner')
  )
);
