# Calenber 알림 시스템 스펙

> AI(Codex / Cursor 등)에게 넘기기 위한 설계 문서.  
> DB 스키마, 파일 구조, 타입, 함수 시그니처, 흐름을 모두 포함한다.

---

## 1. 전체 구조

```
알림 발생 원천
  ├─ 캘린더 뮤테이션 (가입, 설정 변경)
  ├─ 이벤트 뮤테이션 (생성, 수정, 삭제)
  └─ 참가자·태그 변경

         ↓ (명시적 액션)

/api/notifications/trigger  (Next.js API Route)
  ├─ 인증 확인 (서버 Supabase)
  ├─ 30초 dedup 체크
  └─ create_notification RPC (service_role)
       ↓
  notifications 테이블 삽입
  notification_digests 테이블 업서트 (같은 digest_key 집계)
       ↓
  Supabase Realtime → 클라이언트 수신
       ↓
  useNotificationRealtime 훅 → upsertDigest
       ↓
  NotificationStoreState.digests 갱신

  └─ (별도) supabase/functions/send-notification
        ├─ Web Push (VAPID) — RFC 8292 JWT + RFC 8291 aes128gcm 암호화
        └─ 이메일 (Resend API)

알림 발생 원천 B — DB Trigger (event_history 기반)
  event_history INSERT
    → notify_event_history_insert() 트리거
    → calendar_members 활성 멤버 순회
    → create_notification RPC (actor 제외)
    → notifications INSERT + notification_digests UPSERT
    → Supabase Realtime → 클라이언트 수신
```

---

## 2. DB 스키마

### 마이그레이션 파일

`supabase/migrations/20260506100000_add_notification_system.sql`

### 테이블

#### `user_notification_preferences`

| 컬럼          | 타입    | 설명                                 |
| ------------- | ------- | ------------------------------------ |
| user_id       | uuid PK | auth.users FK                        |
| push_enabled  | boolean | 푸시 알림 on/off                     |
| email_enabled | boolean | 이메일 알림 on/off                   |
| type_settings | jsonb   | `{ "calendar_joined": true, ... }`   |
| email_digest  | text    | `realtime \| daily \| weekly \| off` |
| quiet_hours   | jsonb   | `{ start: "23:00", end: "07:00" }`   |

#### `push_subscriptions`

| 컬럼         | 타입                | 설명                  |
| ------------ | ------------------- | --------------------- |
| id           | uuid PK             |                       |
| user_id      | uuid                | auth.users FK         |
| endpoint     | text                | Web Push endpoint URL |
| p256dh       | text                | VAPID 공개키          |
| auth_key     | text                | VAPID auth            |
| device_label | text?               | UA 문자열 (선택)      |
| expires_at   | timestamptz?        | 만료일                |
| UNIQUE       | (user_id, endpoint) |                       |

#### `notifications`

| 컬럼              | 타입         | 설명                                       |
| ----------------- | ------------ | ------------------------------------------ |
| id                | uuid PK      |                                            |
| recipient_id      | uuid         | 수신자                                     |
| actor_id          | uuid?        | 발신자 (시스템 = null)                     |
| notification_type | text CHECK   | 아래 타입 목록 참고                        |
| entity_type       | text CHECK   | `calendar \| event \| comment \| reaction` |
| entity_id         | text         | 연관 엔티티 ID                             |
| calendar_id       | uuid?        | 빠른 필터용 역정규화                       |
| metadata          | jsonb        | 렌더링용 스냅샷                            |
| digest_key        | text         | `"{type}:{entityType}:{entityId}"`         |
| is_read           | boolean      |                                            |
| push_sent_at      | timestamptz? |                                            |
| email_sent_at     | timestamptz? |                                            |

#### `notification_digests`

| 컬럼                   | 타입                       | 설명                   |
| ---------------------- | -------------------------- | ---------------------- |
| id                     | uuid PK                    |                        |
| recipient_id           | uuid                       |                        |
| digest_key             | text                       | notifications 와 동일  |
| latest_notification_id | uuid?                      | 대표 알림 FK           |
| count                  | int                        | 집계 총 수             |
| actor_ids              | uuid[]                     | 최대 5명 저장 (표시용) |
| unread_count           | int                        | 읽지 않은 수           |
| last_occurred_at       | timestamptz                | 마지막 발생 시각       |
| UNIQUE                 | (recipient_id, digest_key) |                        |

### 알림 타입 목록

```
calendar_joined
calendar_settings_changed
event_created
event_updated
event_deleted
event_tagged
event_participant_added
event_comment_added      (미래)
event_comment_replied    (미래)
event_reaction           (미래)
```

### RPC 함수

| 함수                                                  | 권한              | 설명                      |
| ----------------------------------------------------- | ----------------- | ------------------------- |
| `get_notifications(p_limit, p_cursor, p_unread_only)` | authenticated     | 알림 목록 (페이지네이션)  |
| `mark_notifications_read(p_digest_keys)`              | authenticated     | 읽음 처리 (null = 전체)   |
| `get_unread_notification_count()`                     | authenticated     | 읽지 않은 수              |
| `create_notification(...)`                            | service_role 전용 | 알림 생성 + digest 업서트 |

---

## 3. 파일 구조

```
apps/web/
├── store/
│   ├── notification-store.types.ts     # 도메인 타입 단일 소스
│   └── useNotificationStore.ts         # Zustand 스토어
│
├── lib/notification/
│   ├── queries.ts      # fetchNotifications, fetchUnreadNotificationCount, fetchNotificationPreferences
│   ├── mutations.ts    # markNotificationsRead, saveNotificationPreferences, savePushSubscription
│   ├── trigger.ts      # triggerNotification (fetch /api/notifications/trigger)
│   │                   # + buildCalendarJoinedPayload, buildEventCreatedPayload, ...
│   ├── push.ts         # subscribePushNotifications, unsubscribePushNotifications
│   ├── realtime.ts     # mapRealtimeDigestRow, getNotificationRealtimeTopic
│   └── format.ts       # formatNotificationBody, resolveNotificationAvatar, resolveNotificationHref
│
├── hooks/
│   └── use-notification-realtime.ts    # Supabase Realtime 구독 훅
│
├── components/notifications/
│   ├── notification-avatar.tsx         # 알림 아바타 (캘린더 or 유저)
│   ├── notification-item.tsx           # 알림 아이템 (드롭다운 / 페이지 공용)
│   └── notification-dropdown.tsx       # nav-actions에 마운트되는 Bell + 드롭다운
│
├── app/
│   ├── notifications/
│   │   ├── page.tsx                    # 서버 컴포넌트 (SSR 초기 데이터)
│   │   └── notifications-page-client.tsx
│   └── api/notifications/
│       └── trigger/route.ts            # POST /api/notifications/trigger
│
├── components/settings/panels/
│   └── profile-notification-settings-panel.tsx
│
├── messages/
│   ├── ko.json   # notification.*, settings.profileNotification.*
│   └── en.json   # 동일 구조
│
└── worker/index.ts   # push + notificationclick 핸들러

supabase/
├── migrations/
│   ├── 20260506100000_add_notification_system.sql
│   └── 20260506200000_add_event_history_notification_trigger.sql   # event_history INSERT 트리거
└── functions/send-notification/
    ├── index.ts      # Edge Function — VAPID Web Push + Resend 이메일
    └── deno.json     # Deno 컴파일러 옵션 (lib: deno.ns)
```

---

## 4. 핵심 타입

```typescript
// store/notification-store.types.ts

type NotificationType =
  | "calendar_joined" | "calendar_settings_changed"
  | "event_created" | "event_updated" | "event_deleted"
  | "event_tagged" | "event_participant_added"
  | "event_comment_added" | "event_comment_replied" | "event_reaction"

type NotificationDigest = {
  digestKey: string           // "{type}:{entityType}:{entityId}"
  count: number
  unreadCount: number
  actorIds: string[]          // 최대 5명
  lastOccurredAt: number      // ms timestamp
  notificationId: string
  notificationType: NotificationType
  entityType: "calendar" | "event" | "comment" | "reaction"
  entityId: string
  calendarId: string | null
  metadata: NotificationMetadata
  isRead: boolean
  createdAt: number
}

type NotificationMetadata = {
  title?: string
  calendarName?: string
  calendarAvatarUrl?: string
  actorName?: string
  actorAvatarUrl?: string
  eventStart?: string
  eventAllDay?: boolean
  changedFields?: string[]
  previousTitle?: string
}

type UserNotificationPreferences = {
  userId: string
  pushEnabled: boolean
  emailEnabled: boolean
  typeSettings: Partial<Record<NotificationType, boolean>>
  emailDigest: "realtime" | "daily" | "weekly" | "off"
  quietHours: { start: string; end: string } | null
}
```

---

## 5. 함수 시그니처

### lib/notification/queries.ts

```typescript
fetchNotifications(
  supabase: SupabaseClient,
  options?: { limit?: number; cursor?: string | null; unreadOnly?: boolean }
): Promise<{ digests: NotificationDigest[]; hasMore: boolean }>

fetchUnreadNotificationCount(supabase: SupabaseClient): Promise<number>

fetchNotificationPreferences(supabase: SupabaseClient): Promise<UserNotificationPreferences | null>
```

### lib/notification/mutations.ts

```typescript
markNotificationsRead(supabase, digestKeys: string[] | null): Promise<void>

saveNotificationPreferences(supabase, userId: string, patch: PreferencesPatch): Promise<void>

savePushSubscription(supabase, userId: string, subscription: PushSubscription, deviceLabel?: string): Promise<void>

deletePushSubscription(supabase, endpoint: string): Promise<void>
```

### lib/notification/trigger.ts

```typescript
triggerNotification(payload: TriggerNotificationPayload): Promise<void>

// 편의 빌더
buildCalendarJoinedPayload(opts): TriggerNotificationPayload
buildCalendarSettingsChangedPayload(opts): TriggerNotificationPayload
buildEventCreatedPayload(opts): TriggerNotificationPayload
buildEventUpdatedPayload(opts): TriggerNotificationPayload
buildEventTaggedPayload(opts): TriggerNotificationPayload
buildEventParticipantAddedPayload(opts): TriggerNotificationPayload
```

### lib/notification/push.ts

```typescript
subscribePushNotifications(userId: string): Promise<PushSubscription | null>
unsubscribePushNotifications(): Promise<void>
getPushSubscriptionStatus(): Promise<{ permission: NotificationPermission; isSubscribed: boolean }>
```

### store/useNotificationStore.ts

```typescript
useNotificationStore(selector?): T | U

// 주요 액션
loadNotifications(): Promise<void>
loadMoreNotifications(): Promise<void>
upsertDigest(digest: NotificationDigest): void
markRead(digestKeys: string[]): Promise<void>
markAllRead(): Promise<void>
loadPreferences(): Promise<void>
savePreferences(patch: Partial<UserNotificationPreferences>): Promise<void>
```

---

## 6. 알림 발생 → 수신 흐름

### A. 명시적 액션 (캘린더 가입, 참가자 추가 등)

```
뮤테이션 함수 (mutations.ts / useCalendarStore)
  → triggerNotification(buildCalendarJoinedPayload(...))
  → POST /api/notifications/trigger
      → 인증 확인
      → 30초 dedup 체크
      → create_notification RPC (×수신자 수)
          → notifications INSERT
          → notification_digests UPSERT
  → Realtime postgres_changes → use-notification-realtime.ts
  → upsertDigest → NotificationStore.digests 갱신
  → Bell 배지 숫자 업데이트
```

### B. debounce 실시간 수정 (일정 제목·내용·참가자 변경) ✅ 구현됨

debounce 입력에서는 클라이언트 트리거 대신 DB Trigger를 사용한다:

- **구현**: `supabase/migrations/20260506200000_add_event_history_notification_trigger.sql`
- `AFTER INSERT ON public.event_history` 트리거 → `notify_event_history_insert()` 함수 호출
- `event_history.action` → `event_created / event_updated / event_deleted` 알림 타입으로 매핑
- 트리거 내에서 `calendar_members` 활성 멤버 전원에게 `create_notification` RPC 호출 (actor 본인 제외)
- digest_key = `event_updated:event:{eventId}` 이므로 30초 내 연속 수정은 1개 알림으로 묶임
- `EXCEPTION WHEN OTHERS` 내부 처리로 알림 실패가 원본 이벤트 쓰기 트랜잭션을 롤백하지 않음

### C. 알림 표시 집계 ("A님 외 2명이 가입했습니다")

- 같은 `digest_key`를 가진 알림이 들어오면 `notification_digests.count++`, `actor_ids` 배열 갱신
- `buildBodyText()` 함수에서 `count > 1`이면 "외 N명" 형식으로 표시
- `actor_ids[0]`이 가장 최근 actor

---

## 7. 알람 중복 방지 전략

| 상황                          | 방법                                       |
| ----------------------------- | ------------------------------------------ |
| 30초 내 동일 actor+digest_key | `/api/notifications/trigger` 서버에서 스킵 |
| debounce 실시간 수정          | digest_key로 자동 집계 (count++ 만 됨)     |
| 자기 자신 제외                | `recipientId === actorId` 필터링           |
| 동일 push 중복 발송           | tag 값으로 서비스워커 알림 대치            |

---

## 8. 환경 변수

### apps/web/.env

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=   # Web Push VAPID 공개키
SUPABASE_SERVICE_ROLE_KEY=      # /api/notifications/trigger 서버 전용
```

### Supabase Edge Function Secrets

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT                   # "mailto:admin@calenber.com"
RESEND_API_KEY
APP_URL                         # "https://calenber.com"
```

---

## 9. 알림 설정 패널 위치

`apps/web/components/settings/panels/profile-notification-settings-panel.tsx`

설정 모달 탭: `profile_notification` (기존 settings-modal.tsx 에 이미 연결됨)

항목:

- 푸시 알림 on/off
- 이메일 알림 on/off + 빈도 (즉시/일간/주간/끄기)
- 알림 종류별 개별 on/off

---

## 10. 구현 현황 및 확장 포인트

| 항목                                 | 상태        | 비고                                                                                      |
| ------------------------------------ | ----------- | ----------------------------------------------------------------------------------------- |
| VAPID Web Push 실제 발송             | ✅ 구현됨   | RFC 8292 VAPID JWT + RFC 8291 aes128gcm 암호화, 외부 패키지 없이 Deno SubtleCrypto만 사용 |
| 이메일 발송 (Resend)                 | ✅ 구현됨   | RESEND_API_KEY 설정 후 즉시 동작                                                          |
| DB Trigger (event_history 기반 알림) | ✅ 구현됨   | `20260506200000_add_event_history_notification_trigger.sql`                               |
| 조용한 시간대(quiet_hours) 적용      | DB 저장만   | Edge Function에서 체크 필요                                                               |
| 이메일 다이제스트 집계 발송          | 미구현      | Supabase Cron + Edge Function으로 구현                                                    |
| 댓글·반응 알림                       | 타입만 정의 | 댓글 기능 추가 시 바로 연결 가능                                                          |

---

## 11. 배포 체크리스트

### Edge Function 배포

```bash
supabase functions deploy send-notification
```

### Supabase Edge Function Secrets 설정

```bash
supabase secrets set VAPID_PUBLIC_KEY=<공개키>
supabase secrets set VAPID_PRIVATE_KEY=<비밀키>   # raw Base64url P-256 스칼라
supabase secrets set VAPID_SUBJECT=mailto:admin@calenber.com
supabase secrets set RESEND_API_KEY=<키>
supabase secrets set APP_URL=https://calenber.com
```

> **주의**: `VAPID_PRIVATE_KEY`는 raw Base64url P-256 스칼라 값을 그대로 설정한다.  
> Edge Function의 `buildVapidJwt`는 `importKey("pkcs8", ...)` 포맷을 사용하므로,  
> 키가 raw 스칼라인 경우 PKCS#8 DER 변환이 필요하거나 `importKey` 포맷을 `"raw"`로 변경해야 한다.  
> 배포 전 키 포맷을 확인할 것.

### DB 마이그레이션 적용

```bash
supabase db push
```

또는 Supabase Dashboard > SQL Editor에서 직접 실행.

### apps/web 환경 변수 확인

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<공개키>
SUPABASE_SERVICE_ROLE_KEY=<서비스롤키>
```
