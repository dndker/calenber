drop trigger if exists zz_delete_event_history_for_deleted_event on public.events;

drop function if exists public.delete_event_history_for_deleted_event();

delete from public.event_history as history
where not exists (
  select 1
  from public.events as events
  where events.id = history.event_id
);

alter table public.event_history
drop constraint if exists event_history_event_id_fkey;

alter table public.event_history
add constraint event_history_event_id_fkey
foreign key (event_id)
references public.events (id)
on delete cascade;

create or replace function public.log_calendar_event_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_action public.event_history_action;
  target_changes jsonb;
  target_summary text;
  target_calendar_id uuid := coalesce(new.calendar_id, old.calendar_id);
  target_event_id uuid := coalesce(new.id, old.id);
  actor_id uuid;
begin
  if tg_op = 'DELETE' then
    return null;
  end if;

  target_action := case tg_op
    when 'INSERT' then 'created'::public.event_history_action
    when 'UPDATE' then 'updated'::public.event_history_action
    else null
  end;

  target_changes := public.build_calendar_event_history_changes(old, new, tg_op);

  if tg_op = 'UPDATE' and jsonb_array_length(target_changes) = 0 then
    return null;
  end if;

  target_summary := public.build_calendar_event_history_summary(
    target_action,
    target_changes
  );

  actor_id := coalesce(
    auth.uid(),
    new.updated_by,
    new.created_by
  );

  insert into public.event_history (
    calendar_id,
    event_id,
    action,
    actor_user_id,
    summary,
    changes,
    occurred_at
  )
  values (
    target_calendar_id,
    target_event_id,
    target_action,
    actor_id,
    target_summary,
    target_changes,
    now()
  );

  return null;
end;
$$;
