-- Idempotent repair: some databases may not have applied 20260423133000 yet,
-- which causes PostgREST PGRST204 (column missing from schema cache).
alter table public.events
add column if not exists all_day boolean not null default false;

alter table public.events
add column if not exists timezone text not null default 'Asia/Seoul';

update public.events
set
  timezone = 'Asia/Seoul'
where
  nullif(btrim(timezone), '') is null;
