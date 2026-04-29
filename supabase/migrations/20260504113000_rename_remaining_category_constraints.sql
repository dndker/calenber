-- Rename remaining category-era constraint names to collection-era names.
-- This is name-only cleanup for already-migrated schemas and is safe to run
-- repeatedly across environments with different migration histories.

do $$
begin
  if to_regclass('public.event_collections') is not null and exists (
    select 1
    from pg_constraint
    where conname = 'event_categories_options_valid_check'
      and conrelid = 'public.event_collections'::regclass
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'event_collections_options_valid_check'
      and conrelid = 'public.event_collections'::regclass
  ) then
    alter table public.event_collections
      rename constraint event_categories_options_valid_check to event_collections_options_valid_check;
  end if;
end$$;

do $$
begin
  if to_regclass('public.events') is not null and exists (
    select 1
    from pg_constraint
    where conname = 'events_category_matches_calendar_check'
      and conrelid = 'public.events'::regclass
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'events_primary_collection_matches_calendar_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      rename constraint events_category_matches_calendar_check to events_primary_collection_matches_calendar_check;
  end if;
end$$;

do $$
begin
  if to_regclass('public.events') is not null and exists (
    select 1
    from pg_constraint
    where conname = 'events_category_id_fkey'
      and conrelid = 'public.events'::regclass
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'events_primary_collection_id_fkey'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      rename constraint events_category_id_fkey to events_primary_collection_id_fkey;
  end if;
end$$;

do $$
begin
  if to_regclass('public.event_collection_assignments') is not null and exists (
    select 1
    from pg_constraint
    where conname = 'event_category_assignments_category_id_fkey'
      and conrelid = 'public.event_collection_assignments'::regclass
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'event_collection_assignments_collection_id_fkey'
      and conrelid = 'public.event_collection_assignments'::regclass
  ) then
    alter table public.event_collection_assignments
      rename constraint event_category_assignments_category_id_fkey to event_collection_assignments_collection_id_fkey;
  end if;
end$$;

do $$
begin
  if to_regclass('public.event_collection_assignments') is not null and exists (
    select 1
    from pg_constraint
    where conname = 'event_category_assignments_event_id_category_id_key'
      and conrelid = 'public.event_collection_assignments'::regclass
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'event_collection_assignments_event_id_collection_id_key'
      and conrelid = 'public.event_collection_assignments'::regclass
  ) then
    alter table public.event_collection_assignments
      rename constraint event_category_assignments_event_id_category_id_key to event_collection_assignments_event_id_collection_id_key;
  end if;
end$$;

do $$
begin
  if to_regclass('public.calendar_subscription_catalogs') is not null and exists (
    select 1
    from pg_constraint
    where conname = 'calendar_subscription_catalogs_source_category_id_fkey'
      and conrelid = 'public.calendar_subscription_catalogs'::regclass
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'calendar_subscription_catalogs_source_collection_id_fkey'
      and conrelid = 'public.calendar_subscription_catalogs'::regclass
  ) then
    alter table public.calendar_subscription_catalogs
      rename constraint calendar_subscription_catalogs_source_category_id_fkey to calendar_subscription_catalogs_source_collection_id_fkey;
  end if;
end$$;
