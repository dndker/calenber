-- ================================
-- 구독 아키텍처 (카탈로그 + 설치 상태)
-- ================================

create table if not exists public.calendar_subscription_catalogs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  source_type text not null check (
    source_type in ('system_holiday', 'shared_category', 'shared_calendar', 'custom')
  ),
  visibility text not null default 'public' check (
    visibility in ('public', 'unlisted', 'private')
  ),
  verified boolean not null default false,
  category_color text null,
  config jsonb not null default '{}'::jsonb,
  owner_user_id uuid null references auth.users(id) on delete set null,
  source_calendar_id uuid null references public.calendars(id) on delete cascade,
  source_category_id uuid null references public.event_categories(id) on delete cascade,
  created_by uuid null references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_subscription_catalogs_source_consistency_check check (
    (source_type = 'system_holiday' and source_calendar_id is null and source_category_id is null)
    or (source_type = 'shared_category' and source_calendar_id is not null and source_category_id is not null)
    or (source_type in ('shared_calendar', 'custom'))
  )
);

create table if not exists public.calendar_subscription_installs (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  subscription_catalog_id uuid not null references public.calendar_subscription_catalogs(id) on delete cascade,
  is_visible boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (calendar_id, subscription_catalog_id)
);

create index if not exists calendar_subscription_catalogs_source_calendar_idx
  on public.calendar_subscription_catalogs(source_calendar_id);

create index if not exists calendar_subscription_catalogs_source_category_idx
  on public.calendar_subscription_catalogs(source_category_id);

create index if not exists calendar_subscription_catalogs_visibility_idx
  on public.calendar_subscription_catalogs(visibility, is_active);

create index if not exists calendar_subscription_installs_calendar_idx
  on public.calendar_subscription_installs(calendar_id, is_visible);

create or replace function public.touch_calendar_subscription_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_calendar_subscription_catalogs_updated_at on public.calendar_subscription_catalogs;
create trigger touch_calendar_subscription_catalogs_updated_at
before update on public.calendar_subscription_catalogs
for each row
execute function public.touch_calendar_subscription_updated_at();

drop trigger if exists touch_calendar_subscription_installs_updated_at on public.calendar_subscription_installs;
create trigger touch_calendar_subscription_installs_updated_at
before update on public.calendar_subscription_installs
for each row
execute function public.touch_calendar_subscription_updated_at();

-- ================================
-- RLS
-- ================================

alter table public.calendar_subscription_catalogs enable row level security;
alter table public.calendar_subscription_installs enable row level security;

drop policy if exists "calendar subscription catalogs are readable" on public.calendar_subscription_catalogs;
create policy "calendar subscription catalogs are readable"
on public.calendar_subscription_catalogs
for select
using (
  is_active = true
  and (
    visibility = 'public'
    or (
      visibility = 'unlisted'
      and (
        owner_user_id = auth.uid()
        or (
          source_calendar_id is not null
          and public.is_active_calendar_member(source_calendar_id)
        )
      )
    )
    or (
      visibility = 'private'
      and (
        owner_user_id = auth.uid()
        or (
          source_calendar_id is not null
          and public.is_active_calendar_member(source_calendar_id)
        )
      )
    )
  )
);

drop policy if exists "calendar subscription catalogs are insertable by editors" on public.calendar_subscription_catalogs;
create policy "calendar subscription catalogs are insertable by editors"
on public.calendar_subscription_catalogs
for insert
with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and (
    source_type = 'system_holiday'
    or (
      source_calendar_id is not null
      and public.has_calendar_role(source_calendar_id, array['editor', 'manager', 'owner'])
    )
  )
);

drop policy if exists "calendar subscription catalogs are updatable by managers" on public.calendar_subscription_catalogs;
create policy "calendar subscription catalogs are updatable by managers"
on public.calendar_subscription_catalogs
for update
using (
  owner_user_id = auth.uid()
  or (
    source_calendar_id is not null
    and public.has_calendar_role(source_calendar_id, array['manager', 'owner'])
  )
)
with check (
  owner_user_id = auth.uid()
  or (
    source_calendar_id is not null
    and public.has_calendar_role(source_calendar_id, array['manager', 'owner'])
  )
);

drop policy if exists "calendar subscription catalogs are deletable by managers" on public.calendar_subscription_catalogs;
create policy "calendar subscription catalogs are deletable by managers"
on public.calendar_subscription_catalogs
for delete
using (
  owner_user_id = auth.uid()
  or (
    source_calendar_id is not null
    and public.has_calendar_role(source_calendar_id, array['manager', 'owner'])
  )
);

drop policy if exists "calendar subscription installs are readable by members" on public.calendar_subscription_installs;
create policy "calendar subscription installs are readable by members"
on public.calendar_subscription_installs
for select
using (public.is_active_calendar_member(calendar_id));

drop policy if exists "calendar subscription installs are writable by editors" on public.calendar_subscription_installs;
create policy "calendar subscription installs are writable by editors"
on public.calendar_subscription_installs
for all
using (public.has_calendar_role(calendar_id, array['editor', 'manager', 'owner']))
with check (public.has_calendar_role(calendar_id, array['editor', 'manager', 'owner']));

-- ================================
-- RPC: 마켓/설치 조회
-- ================================

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
    )
    and (
      normalized_query.q is null
      or lower(catalogs.name) like '%' || lower(normalized_query.q) || '%'
      or lower(catalogs.description) like '%' || lower(normalized_query.q) || '%'
      or lower(catalogs.slug) like '%' || lower(normalized_query.q) || '%'
    )
  order by
    installed desc,
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
    catalogs.category_color,
    catalogs.config,
    installs.is_visible,
    installs.created_at as installed_at
  from public.calendar_subscription_installs as installs
  join public.calendar_subscription_catalogs as catalogs
    on catalogs.id = installs.subscription_catalog_id
  where installs.calendar_id = target_calendar_id
    and catalogs.is_active = true
  order by installs.created_at asc;
$$;

grant execute on function public.get_calendar_installed_subscriptions(uuid) to authenticated;

-- ================================
-- Seed: 대한민국 공휴일 시스템 구독
-- ================================

insert into public.calendar_subscription_catalogs (
  slug,
  name,
  description,
  source_type,
  visibility,
  verified,
  category_color,
  config,
  created_by,
  owner_user_id
)
values (
  'subscription.kr.public-holidays',
  '대한민국 공휴일',
  '대한민국 법정 공휴일을 자동 생성합니다. 음력 명절과 대체공휴일을 포함합니다.',
  'system_holiday',
  'public',
  true,
  'red',
  jsonb_build_object(
    'locale', 'ko-KR',
    'timezone', 'Asia/Seoul',
    'provider', 'korean_public_holidays_v1'
  ),
  null,
  null
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  verified = excluded.verified,
  category_color = excluded.category_color,
  config = excluded.config,
  is_active = true;
