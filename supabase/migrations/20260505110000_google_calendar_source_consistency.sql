-- google_calendar source_type을 source_consistency_check 제약에 추가
alter table public.calendar_subscription_catalogs
  drop constraint if exists calendar_subscription_catalogs_source_consistency_check;

alter table public.calendar_subscription_catalogs
  add constraint calendar_subscription_catalogs_source_consistency_check check (
    (source_type = 'system_holiday' and source_calendar_id is null and source_collection_id is null)
    or (source_type = 'shared_collection' and source_calendar_id is not null and source_collection_id is not null)
    or (source_type in ('shared_calendar', 'custom', 'google_calendar'))
  );
