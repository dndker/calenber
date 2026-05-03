-- Google Calendar Integration
-- 1. user_google_integrations: Google OAuth 토큰 저장 (유저 계정별)
-- 2. google_calendar_subscriptions: 어떤 캘린더가 어떤 구글 캘린더를 구독하는지
-- 3. google_calendar_sync_channels: Google push webhook 채널 추적
-- 4. calendar_subscription_catalogs.source_type 에 'google_calendar' 값 허용

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. source_type 체크 제약 업데이트 (google_calendar 추가)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.calendar_subscription_catalogs') is not null then
    -- 기존 제약 제거
    if exists (
      select 1 from pg_constraint
      where conrelid = 'public.calendar_subscription_catalogs'::regclass
        and contype = 'c'
        and conname like '%source_type%'
    ) then
      execute (
        select 'alter table public.calendar_subscription_catalogs drop constraint ' || conname
        from pg_constraint
        where conrelid = 'public.calendar_subscription_catalogs'::regclass
          and contype = 'c'
          and conname like '%source_type%'
        limit 1
      );
    end if;

    -- 새 제약 추가 (google_calendar 포함)
    alter table public.calendar_subscription_catalogs
      add constraint calendar_subscription_catalogs_source_type_check
      check (source_type in (
        'system_holiday',
        'shared_collection',
        'shared_calendar',
        'google_calendar',
        'custom'
      ));
  end if;
end$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. user_google_integrations: 유저별 Google OAuth 토큰 저장
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.user_google_integrations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  -- Google 계정 식별 (sub claim)
  google_account_id   text not null,
  google_email        text not null,
  google_display_name text,
  -- 암호화된 토큰 (서버에서만 접근)
  access_token    text not null,
  refresh_token   text,
  token_expires_at timestamptz,
  -- 허용된 스코프
  scopes          text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(user_id, google_account_id)
);

-- RLS
alter table public.user_google_integrations enable row level security;

create policy "user_google_integrations_own"
  on public.user_google_integrations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'user_google_integrations_updated_at'
  ) then
    create trigger user_google_integrations_updated_at
      before update on public.user_google_integrations
      for each row execute function public.set_updated_at();
  end if;
end$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. google_calendar_sync_channels: Google push webhook 채널 추적
--    Google Watch API가 반환하는 채널 ID / 리소스 ID를 저장해 갱신·해제에 사용
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.google_calendar_sync_channels (
  id                      uuid primary key default gen_random_uuid(),
  -- 어떤 구독 카탈로그에 속한 채널인지
  subscription_catalog_id uuid not null references public.calendar_subscription_catalogs(id) on delete cascade,
  -- Google Watch API 응답
  channel_id              text not null unique,
  resource_id             text not null,
  -- 채널 만료 시각 (Google은 최대 7일)
  expiration              timestamptz not null,
  -- 대상 Google 캘린더 ID (e.g. primary, xxx@group.calendar.google.com)
  google_calendar_id      text not null,
  -- 이 채널을 생성한 유저 (토큰 갱신 시 사용)
  owner_user_id           uuid not null references auth.users(id) on delete cascade,
  created_at              timestamptz not null default now()
);

alter table public.google_calendar_sync_channels enable row level security;

-- 서비스 롤(Edge Function)만 접근 — 클라이언트 직접 접근 차단
create policy "google_calendar_sync_channels_service_only"
  on public.google_calendar_sync_channels
  for all
  using (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. get_google_calendar_catalogs RPC
--    특정 캘린더에 설치된 google_calendar 타입 구독 카탈로그와 연결된
--    Google 계정 정보를 함께 반환
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.get_google_calendar_catalogs(uuid, uuid);

create or replace function public.get_google_calendar_catalogs(
  p_calendar_id  uuid,
  p_user_id      uuid
)
returns table (
  out_catalog_id        uuid,
  out_catalog_name      text,
  out_google_calendar_id text,
  out_google_email      text,
  out_google_account_id text,
  out_is_visible        boolean,
  out_collection_color  text,
  out_sync_token        text
)
language plpgsql security definer
set search_path = public
as $$
begin
  return query
  select
    csc.id,
    csc.name,
    (csc.config->>'googleCalendarId')::text,
    ugi.google_email,
    ugi.google_account_id,
    coalesce(csi.is_visible, false),
    csc.collection_color,
    (csc.config->>'syncToken')::text
  from calendar_subscription_catalogs csc
  join calendar_subscription_installs csi
    on csi.subscription_catalog_id = csc.id
    and csi.calendar_id = p_calendar_id
  left join user_google_integrations ugi
    on ugi.user_id = p_user_id
    and ugi.google_account_id = (csc.config->>'googleAccountId')::text
  where csc.source_type = 'google_calendar';
end;
$$;

grant execute on function public.get_google_calendar_catalogs(uuid, uuid)
  to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. 기존 get_calendar_subscription_catalog RPC에 google_calendar 포함되도록
--    source_type 필터 제거 확인 (현재 RPC는 모든 source_type 반환하므로 변경 불필요)
-- ─────────────────────────────────────────────────────────────────────────────
-- google_calendar 타입의 카탈로그도 기존 RPC로 조회되므로 별도 수정 불필요.
-- config 필드에 아래 구조로 저장됨:
-- {
--   "provider": "google_calendar_v1",
--   "googleCalendarId": "primary",
--   "googleAccountId": "...",  -- user_google_integrations.google_account_id
--   "syncToken": "..."         -- 증분 동기화용
-- }
