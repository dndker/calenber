-- =========================================================
-- 원본 삭제 시 구독 카탈로그 보존 + 삭제 상태 표시
-- =========================================================

-- 1) 카탈로그 상태 컬럼 추가
alter table public.calendar_subscription_catalogs
add column if not exists status text not null default 'active'
check (status in ('active', 'source_deleted', 'archived'));

alter table public.calendar_subscription_catalogs
add column if not exists source_deleted_at timestamptz null;

alter table public.calendar_subscription_catalogs
add column if not exists source_deleted_reason text null;

-- 2) source FK cascade -> set null 로 변경
do $$
declare
  source_calendar_fk_name text;
  source_category_fk_name text;
begin
  select tc.constraint_name
  into source_calendar_fk_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'calendar_subscription_catalogs'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'source_calendar_id'
  limit 1;

  if source_calendar_fk_name is not null then
    execute format(
      'alter table public.calendar_subscription_catalogs drop constraint %I',
      source_calendar_fk_name
    );
  end if;

  alter table public.calendar_subscription_catalogs
  add constraint calendar_subscription_catalogs_source_calendar_id_fkey
  foreign key (source_calendar_id)
  references public.calendars(id)
  on delete set null;

  select tc.constraint_name
  into source_category_fk_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'calendar_subscription_catalogs'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'source_category_id'
  limit 1;

  if source_category_fk_name is not null then
    execute format(
      'alter table public.calendar_subscription_catalogs drop constraint %I',
      source_category_fk_name
    );
  end if;

  alter table public.calendar_subscription_catalogs
  add constraint calendar_subscription_catalogs_source_category_id_fkey
  foreign key (source_category_id)
  references public.event_categories(id)
  on delete set null;
end
$$;

-- 3) 원본이 끊긴 카탈로그를 source_deleted 상태로 자동 전환
create or replace function public.mark_subscription_catalog_source_deleted()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    old.source_type in ('shared_category', 'shared_calendar')
    and (
      (old.source_calendar_id is not null and new.source_calendar_id is null)
      or (old.source_type = 'shared_category' and old.source_category_id is not null and new.source_category_id is null)
    )
  ) then
    new.status := 'source_deleted';
    new.source_deleted_at := coalesce(new.source_deleted_at, now());
    new.source_deleted_reason := coalesce(
      new.source_deleted_reason,
      case
        when old.source_type = 'shared_category' then 'source_category_deleted'
        else 'source_calendar_deleted'
      end
    );
  end if;

  return new;
end;
$$;

drop trigger if exists mark_subscription_catalog_source_deleted on public.calendar_subscription_catalogs;
create trigger mark_subscription_catalog_source_deleted
before update of source_calendar_id, source_category_id
on public.calendar_subscription_catalogs
for each row
execute function public.mark_subscription_catalog_source_deleted();

-- 기존 데이터 중 이미 원본 연결이 깨진 공유형 항목 보정
update public.calendar_subscription_catalogs as catalogs
set
  status = 'source_deleted',
  source_deleted_at = coalesce(catalogs.source_deleted_at, now()),
  source_deleted_reason = coalesce(catalogs.source_deleted_reason, 'source_deleted')
where catalogs.source_type in ('shared_category', 'shared_calendar')
  and (
    catalogs.source_calendar_id is null
    or (catalogs.source_type = 'shared_category' and catalogs.source_category_id is null)
  );

-- 4) RLS 조회 정책 업데이트:
--    source_deleted 는 "이미 설치한 사용자"에게는 보여야 함
drop policy if exists "calendar subscription catalogs are readable" on public.calendar_subscription_catalogs;
create policy "calendar subscription catalogs are readable"
on public.calendar_subscription_catalogs
for select
using (
  is_active = true
  and (
    visibility = 'public'
    or owner_user_id = auth.uid()
    or (
      source_calendar_id is not null
      and public.is_active_calendar_member(source_calendar_id)
    )
    or exists (
      select 1
      from public.calendar_subscription_installs as installs
      where installs.subscription_catalog_id = calendar_subscription_catalogs.id
        and public.is_active_calendar_member(installs.calendar_id)
    )
  )
);

-- 5) RPC 확장: 삭제 상태/사유 반환 + source_deleted 항목 노출
drop function if exists public.get_calendar_subscription_catalog(uuid, text);
create or replace function public.get_calendar_subscription_catalog(
  target_calendar_id uuid,
  search_query text default null
)
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  source_type text,
  visibility text,
  verified boolean,
  status text,
  source_deleted_at timestamptz,
  source_deleted_reason text,
  category_color text,
  config jsonb,
  owner_user_id uuid,
  source_calendar_id uuid,
  source_category_id uuid,
  installed boolean,
  is_visible boolean,
  installed_at timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  with normalized_query as (
    select nullif(trim(search_query), '') as q
  )
  select
    catalogs.id,
    catalogs.slug,
    catalogs.name,
    catalogs.description,
    catalogs.source_type,
    catalogs.visibility,
    catalogs.verified,
    catalogs.status,
    catalogs.source_deleted_at,
    catalogs.source_deleted_reason,
    catalogs.category_color,
    catalogs.config,
    catalogs.owner_user_id,
    catalogs.source_calendar_id,
    catalogs.source_category_id,
    installs.id is not null as installed,
    coalesce(installs.is_visible, true) as is_visible,
    installs.created_at as installed_at
  from public.calendar_subscription_catalogs as catalogs
  left join public.calendar_subscription_installs as installs
    on installs.subscription_catalog_id = catalogs.id
   and installs.calendar_id = target_calendar_id
  cross join normalized_query
  where catalogs.is_active = true
    and (
      catalogs.visibility = 'public'
      or catalogs.owner_user_id = auth.uid()
      or (
        catalogs.source_calendar_id is not null
        and public.is_active_calendar_member(catalogs.source_calendar_id)
      )
      or installs.id is not null
    )
    and (
      normalized_query.q is null
      or lower(catalogs.name) like '%' || lower(normalized_query.q) || '%'
      or lower(catalogs.description) like '%' || lower(normalized_query.q) || '%'
      or lower(catalogs.slug) like '%' || lower(normalized_query.q) || '%'
    )
  order by
    installed desc,
    (catalogs.status = 'source_deleted') desc,
    catalogs.verified desc,
    catalogs.created_at desc;
$$;

grant execute on function public.get_calendar_subscription_catalog(uuid, text) to authenticated;

drop function if exists public.get_calendar_installed_subscriptions(uuid);
create or replace function public.get_calendar_installed_subscriptions(
  target_calendar_id uuid
)
returns table (
  install_id uuid,
  subscription_catalog_id uuid,
  slug text,
  name text,
  description text,
  source_type text,
  status text,
  source_deleted_at timestamptz,
  source_deleted_reason text,
  category_color text,
  config jsonb,
  is_visible boolean,
  installed_at timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    installs.id as install_id,
    catalogs.id as subscription_catalog_id,
    catalogs.slug,
    catalogs.name,
    catalogs.description,
    catalogs.source_type,
    catalogs.status,
    catalogs.source_deleted_at,
    catalogs.source_deleted_reason,
    catalogs.category_color,
    catalogs.config,
    installs.is_visible,
    installs.created_at as installed_at
  from public.calendar_subscription_installs as installs
  join public.calendar_subscription_catalogs as catalogs
    on catalogs.id = installs.subscription_catalog_id
  where installs.calendar_id = target_calendar_id
    and catalogs.is_active = true
  order by
    (catalogs.status = 'source_deleted') desc,
    installs.created_at asc;
$$;

grant execute on function public.get_calendar_installed_subscriptions(uuid) to authenticated;
