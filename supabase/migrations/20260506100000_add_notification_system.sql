-- ============================================================
-- 알림 시스템 스키마
-- ============================================================
-- 설계 원칙:
--   1. user_notification_preferences  — 유저별 알림 채널·종류 on/off
--   2. push_subscriptions             — Web Push (VAPID) 구독 정보
--   3. notifications                  — 알림 레코드 (inbox)
--   4. notification_digests           — 같은 종류 알림 집계 (인스타 좋아요처럼 묶기)
--
-- 확장성:
--   - notification_type 은 TEXT CHECK 로 관리 → 마이그레이션 없이 신규 타입 추가 가능
--   - entity_type / entity_id 로 댓글, 리액션 등 미래 엔티티 연결
--   - digest_key 로 같은 (actor, entity, action) 묶음 집계
-- ============================================================

-- ─────────────────────────────────────────
-- 1. 알림 타입 목록 (CHECK 제약)
-- ─────────────────────────────────────────
-- calendar_joined          : 캘린더 가입
-- calendar_settings_changed: 캘린더 설정 변경
-- event_created            : 일정 생성
-- event_updated            : 일정 수정 (내가 참여·즐겨찾기·태그된 일정)
-- event_deleted            : 일정 삭제
-- event_tagged             : 일정에 내가 태그됨
-- event_participant_added  : 일정 참가자로 추가됨
-- event_comment_added      : (미래) 일정에 댓글 달림
-- event_comment_replied    : (미래) 내 댓글에 답글
-- event_reaction           : (미래) 내 일정/댓글에 반응

-- ─────────────────────────────────────────
-- 2. 유저 알림 환경설정 테이블
-- ─────────────────────────────────────────
create table if not exists public.user_notification_preferences (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  -- 채널 on/off
  push_enabled     boolean not null default true,
  email_enabled    boolean not null default false,
  -- 타입별 on/off (JSON object: { "calendar_joined": true, ... })
  type_settings    jsonb   not null default '{}'::jsonb,
  -- 이메일 다이제스트 빈도: "realtime" | "daily" | "weekly" | "off"
  email_digest     text    not null default 'realtime'
                   check (email_digest in ('realtime', 'daily', 'weekly', 'off')),
  -- 조용한 시간대 (서버 UTC 기준, 예: {"start": "23:00", "end": "07:00"})
  quiet_hours      jsonb,
  updated_at       timestamptz not null default now()
);

comment on table public.user_notification_preferences is
  '유저별 알림 채널(푸시/이메일) 및 타입별 수신 설정';

-- ─────────────────────────────────────────
-- 3. Web Push 구독 테이블
-- ─────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- Web Push API PushSubscription JSON
  endpoint    text    not null,
  p256dh      text    not null,
  auth_key    text    not null,
  -- 기기 식별 (UA 또는 앱에서 지정한 라벨)
  device_label text,
  -- 만료 후 정리용
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- 같은 endpoint 중복 방지
  unique (user_id, endpoint)
);

comment on table public.push_subscriptions is
  'Web Push VAPID 구독 정보. endpoint 단위로 유니크';

-- ─────────────────────────────────────────
-- 4. 알림 테이블 (inbox)
-- ─────────────────────────────────────────
create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  -- 수신자
  recipient_id    uuid not null references auth.users(id) on delete cascade,
  -- 발신자 (시스템 알림은 null)
  actor_id        uuid references auth.users(id) on delete set null,

  -- 알림 종류
  notification_type text not null check (notification_type in (
    'calendar_joined',
    'calendar_settings_changed',
    'event_created',
    'event_updated',
    'event_deleted',
    'event_tagged',
    'event_participant_added',
    'event_comment_added',
    'event_comment_replied',
    'event_reaction'
  )),

  -- 연결 엔티티 (확장성: 댓글·반응 등 미래 엔티티 대응)
  entity_type     text not null check (entity_type in (
    'calendar',
    'event',
    'comment',
    'reaction'
  )),
  entity_id       text not null,   -- UUID 또는 생성형 구독 ID

  -- 연관 캘린더 (빠른 필터링용 역정규화)
  calendar_id     uuid references public.calendars(id) on delete cascade,

  -- 알림 메타데이터 (제목, 발신자 이름, 스냅샷 등 렌더링에 필요한 데이터)
  -- 예: { "eventTitle": "...", "calendarName": "...", "actorName": "..." }
  metadata        jsonb not null default '{}'::jsonb,

  -- 집계 키 — 같은 digest_key 를 가진 알림끼리 묶어 표시
  -- 포맷: "{notification_type}:{entity_type}:{entity_id}"
  digest_key      text not null,

  -- 상태
  is_read         boolean not null default false,
  read_at         timestamptz,

  -- 발송 상태 (push / email)
  push_sent_at    timestamptz,
  email_sent_at   timestamptz,

  created_at      timestamptz not null default now()
);

comment on table public.notifications is
  '알림 inbox. digest_key 로 같은 종류 알림을 집계해 표시';

-- 빠른 inbox 조회용 인덱스
create index if not exists notifications_recipient_created
  on public.notifications(recipient_id, created_at desc);

create index if not exists notifications_recipient_unread
  on public.notifications(recipient_id, is_read)
  where is_read = false;

create index if not exists notifications_digest_key
  on public.notifications(digest_key, created_at desc);

-- ─────────────────────────────────────────
-- 5. 알림 집계(digest) 테이블
-- ─────────────────────────────────────────
-- 같은 digest_key 를 가진 알림들을 하나의 행으로 합쳐 표시하기 위한 뷰 역할
-- 직접 집계 쿼리 대신 캐싱 목적으로 사용
create table if not exists public.notification_digests (
  id              uuid primary key default gen_random_uuid(),
  recipient_id    uuid not null references auth.users(id) on delete cascade,
  digest_key      text not null,
  -- 최신 알림 ID (대표 알림)
  latest_notification_id uuid references public.notifications(id) on delete set null,
  -- 집계된 알림 수
  count           int  not null default 1,
  -- 집계에 포함된 actor id 목록 (최대 3명 저장, 표시용)
  actor_ids       uuid[] not null default '{}',
  -- 안 읽은 수
  unread_count    int  not null default 1,
  -- 마지막 활동
  last_occurred_at timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (recipient_id, digest_key)
);

comment on table public.notification_digests is
  '동일 digest_key 알림 집계. "A님 외 3명이 가입했습니다" 형식 표시용';

create index if not exists notification_digests_recipient
  on public.notification_digests(recipient_id, last_occurred_at desc);

-- ─────────────────────────────────────────
-- 6. RLS 정책
-- ─────────────────────────────────────────

-- user_notification_preferences
alter table public.user_notification_preferences enable row level security;

create policy "users can manage own notification preferences"
on public.user_notification_preferences
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- push_subscriptions
alter table public.push_subscriptions enable row level security;

create policy "users can manage own push subscriptions"
on public.push_subscriptions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- notifications: 본인 수신 알림만 읽기·수정(read 표시) 가능
-- 생성은 서비스 롤(Edge Function, 서버)에서만 수행
alter table public.notifications enable row level security;

create policy "users can read own notifications"
on public.notifications
for select
using (auth.uid() = recipient_id);

create policy "users can update own notifications"
on public.notifications
for update
using (auth.uid() = recipient_id)
with check (auth.uid() = recipient_id);

-- notification_digests
alter table public.notification_digests enable row level security;

create policy "users can read own notification digests"
on public.notification_digests
for select
using (auth.uid() = recipient_id);

create policy "users can update own notification digests"
on public.notification_digests
for update
using (auth.uid() = recipient_id)
with check (auth.uid() = recipient_id);

-- ─────────────────────────────────────────
-- 7. RPC: 알림 목록 조회 (집계 포함)
-- ─────────────────────────────────────────
drop function if exists public.get_notifications(
  p_limit int,
  p_cursor timestamptz,
  p_unread_only boolean
);

create or replace function public.get_notifications(
  p_limit       int           default 30,
  p_cursor      timestamptz   default null,
  p_unread_only boolean       default false
)
returns table (
  -- 집계 정보
  digest_key          text,
  count               int,
  unread_count        int,
  actor_ids           uuid[],
  last_occurred_at    timestamptz,
  -- 대표 알림 정보
  notification_id     uuid,
  notification_type   text,
  entity_type         text,
  entity_id           text,
  calendar_id         uuid,
  metadata            jsonb,
  is_read             boolean,
  created_at          timestamptz
)
language sql
security definer
stable
as $$
  select
    nd.digest_key,
    nd.count,
    nd.unread_count,
    nd.actor_ids,
    nd.last_occurred_at,
    n.id              as notification_id,
    n.notification_type,
    n.entity_type,
    n.entity_id,
    n.calendar_id,
    n.metadata,
    nd.unread_count > 0 as is_read,
    nd.last_occurred_at as created_at
  from public.notification_digests nd
  join public.notifications n on n.id = nd.latest_notification_id
  where nd.recipient_id = auth.uid()
    and (p_unread_only = false or nd.unread_count > 0)
    and (p_cursor is null or nd.last_occurred_at < p_cursor)
  order by nd.last_occurred_at desc
  limit p_limit
$$;

grant execute on function public.get_notifications to authenticated;

-- ─────────────────────────────────────────
-- 8. RPC: 알림 읽음 처리
-- ─────────────────────────────────────────
drop function if exists public.mark_notifications_read(
  p_digest_keys text[]
);

create or replace function public.mark_notifications_read(
  p_digest_keys text[] default null  -- null 이면 전체 읽음
)
returns void
language plpgsql
security definer
as $$
begin
  -- notifications 개별 읽음 처리
  update public.notifications
  set is_read = true,
      read_at = now()
  where recipient_id = auth.uid()
    and is_read = false
    and (p_digest_keys is null or digest_key = any(p_digest_keys));

  -- digest unread_count 초기화
  update public.notification_digests
  set unread_count = 0,
      updated_at = now()
  where recipient_id = auth.uid()
    and unread_count > 0
    and (p_digest_keys is null or digest_key = any(p_digest_keys));
end;
$$;

grant execute on function public.mark_notifications_read to authenticated;

-- ─────────────────────────────────────────
-- 9. RPC: 읽지 않은 알림 수 조회
-- ─────────────────────────────────────────
drop function if exists public.get_unread_notification_count();

create or replace function public.get_unread_notification_count()
returns int
language sql
security definer
stable
as $$
  select coalesce(sum(unread_count), 0)::int
  from public.notification_digests
  where recipient_id = auth.uid()
    and unread_count > 0
$$;

grant execute on function public.get_unread_notification_count to authenticated;

-- ─────────────────────────────────────────
-- 10. 내부 함수: 알림 생성 + digest 업서트
--     (Edge Function / 서버에서 service_role 로 호출)
-- ─────────────────────────────────────────
drop function if exists public.create_notification(
  p_recipient_id      uuid,
  p_actor_id          uuid,
  p_notification_type text,
  p_entity_type       text,
  p_entity_id         text,
  p_calendar_id       uuid,
  p_metadata          jsonb
);

create or replace function public.create_notification(
  p_recipient_id      uuid,
  p_actor_id          uuid,
  p_notification_type text,
  p_entity_type       text,
  p_entity_id         text,
  p_calendar_id       uuid    default null,
  p_metadata          jsonb   default '{}'::jsonb
)
returns uuid  -- 생성된 notification id
language plpgsql
security definer
as $$
declare
  v_digest_key  text;
  v_notif_id    uuid;
  v_actor_ids   uuid[];
begin
  -- digest_key 생성
  v_digest_key := p_notification_type || ':' || p_entity_type || ':' || p_entity_id;

  -- 알림 레코드 삽입
  insert into public.notifications (
    recipient_id, actor_id, notification_type,
    entity_type, entity_id, calendar_id,
    metadata, digest_key
  )
  values (
    p_recipient_id, p_actor_id, p_notification_type,
    p_entity_type, p_entity_id, p_calendar_id,
    p_metadata, v_digest_key
  )
  returning id into v_notif_id;

  -- digest 업서트: actor_ids 배열에 신규 actor 추가 (최대 5개)
  select coalesce(actor_ids, '{}') into v_actor_ids
  from public.notification_digests
  where recipient_id = p_recipient_id
    and digest_key = v_digest_key;

  if p_actor_id is not null and not (p_actor_id = any(coalesce(v_actor_ids, '{}'))) then
    v_actor_ids := array_prepend(p_actor_id, coalesce(v_actor_ids, '{}'));
    -- 최대 5개만 보관
    if array_length(v_actor_ids, 1) > 5 then
      v_actor_ids := v_actor_ids[1:5];
    end if;
  end if;

  insert into public.notification_digests (
    recipient_id, digest_key, latest_notification_id,
    count, actor_ids, unread_count, last_occurred_at
  )
  values (
    p_recipient_id, v_digest_key, v_notif_id,
    1, coalesce(v_actor_ids, '{}'), 1, now()
  )
  on conflict (recipient_id, digest_key) do update set
    latest_notification_id = v_notif_id,
    count                  = notification_digests.count + 1,
    actor_ids              = v_actor_ids,
    unread_count           = notification_digests.unread_count + 1,
    last_occurred_at       = now(),
    updated_at             = now();

  return v_notif_id;
end;
$$;

-- create_notification 은 service_role 전용 (클라이언트 직접 호출 금지)
revoke execute on function public.create_notification from anon, authenticated;

-- ─────────────────────────────────────────
-- 11. Realtime: 알림 수신 채널 허용
-- ─────────────────────────────────────────
-- notification_digests 테이블의 변경을 realtime으로 수신하기 위해
-- supabase realtime publication에 추가
alter publication supabase_realtime add table public.notification_digests;
