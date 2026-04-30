-- google_calendar source_type에 대한 INSERT RLS 정책 허용
-- 기존 정책은 system_holiday 또는 source_calendar_id 기반만 허용했으나
-- google_calendar는 owner_user_id 기반으로 본인만 삽입 가능하도록 확장

drop policy if exists "calendar subscription catalogs are insertable by editors" on public.calendar_subscription_catalogs;

create policy "calendar subscription catalogs are insertable by editors"
on public.calendar_subscription_catalogs
for insert
with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and (
    source_type = 'system_holiday'
    or source_type = 'google_calendar'
    or (
      source_calendar_id is not null
      and public.has_calendar_role(source_calendar_id, array['editor', 'manager', 'owner'])
    )
  )
);
