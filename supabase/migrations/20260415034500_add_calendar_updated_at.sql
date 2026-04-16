alter table public.calendars
add column if not exists updated_at timestamptz not null default now();

update public.calendars
set updated_at = created_at
where updated_at is distinct from created_at;

create or replace function public.set_calendar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_calendar_updated_at on public.calendars;

create trigger set_calendar_updated_at
before update on public.calendars
for each row
execute function public.set_calendar_updated_at();
