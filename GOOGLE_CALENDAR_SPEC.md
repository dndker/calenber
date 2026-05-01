# Google Calendar Integration — Spec Document

> 다른 AI(Codex 등)가 이 코드베이스의 Google Calendar 연동 전체를 파악할 수 있도록 작성한 핸드오프 문서.
> 폴더 구조, 각 파일 역할, 주요 함수 시그니처, 데이터 타입, ID 패턴, DB 스키마, 엔드-투-엔드 플로우를 모두 포함한다.

---

## 1. 폴더 구조

```
apps/web/
├── app/api/google-calendar/
│   ├── auth/route.ts          # OAuth URL 생성 (팝업 진입점)
│   ├── callback/route.ts      # OAuth 코드 교환 + DB 저장 + postMessage
│   ├── list/route.ts          # 연결 계정의 Google 캘린더 목록 조회
│   ├── subscribe/route.ts     # Google 캘린더 → Calenber 구독 등록
│   ├── integration/route.ts   # Google 계정 연결 해제 (DELETE)
│   ├── events/route.ts        # 이벤트 CRUD (GET/POST/PATCH/DELETE)
│   └── webhook/route.ts       # Google push 알림 수신 (증분 동기화)
│
├── lib/google/
│   ├── oauth.ts               # OAuth 2.0 헬퍼 (URL 생성, 코드 교환, 토큰 갱신)
│   ├── calendar-api.ts        # Google Calendar REST API 래퍼
│   └── calendar-event-mapper.ts  # Google 이벤트 → CalendarEvent 변환
│
├── hooks/
│   └── use-google-calendar-subscription-events.ts  # 구독 이벤트 fetch + 실시간 동기화
│
└── components/calendar/
    ├── google-calendar-subscribe-dialog.tsx  # 구독 등록 UI 다이얼로그
    ├── event-form-collection-field.tsx       # 컬렉션 선택 (구글/일반 상호 배타)
    ├── event-form.tsx                        # 구글/일반 저장 분기, gcal→local 이동 처리
    └── event-subscription-card.tsx           # 구독 이벤트 메타 표시 카드
```

---

## 2. 파일별 역할

### `lib/google/oauth.ts`
Google OAuth 2.0 순수 함수 모음. 서버 전용.
- 인증 URL 생성, 인가 코드 → 토큰 교환, 토큰 갱신, 유저 정보 조회
- 스코프 상수 및 스코프 검증 유틸

### `lib/google/calendar-api.ts`
Google Calendar REST API `v3` 호출 래퍼. 서버 전용.
- 토큰 갱신 포함 유효 토큰 조회 (`getValidAccessToken`)
- 캘린더 목록, 이벤트 조회(전체/증분), 이벤트 CRUD, push watch 등록/해제

### `lib/google/calendar-event-mapper.ts`
Google API 응답 → `CalendarEvent` 변환. 클라이언트/서버 공용.
- 복합 ID 생성/파싱 (`gcal:<catalogId>:<googleEventId>`)
- 시간 파싱 (종일/시간 지정), 색상 매핑

### `app/api/google-calendar/auth/route.ts`
`GET /api/google-calendar/auth`  
팝업 창에서 Google 인증 URL을 JSON으로 반환한다.

### `app/api/google-calendar/callback/route.ts`
`GET /api/google-calendar/callback`  
OAuth 코드 수신 → 토큰 교환 → `user_google_integrations` upsert → 
`window.opener.postMessage` 후 팝업 닫기.

### `app/api/google-calendar/list/route.ts`
`GET /api/google-calendar/list?accountId=<googleAccountId>`  
연결된 계정의 Google 캘린더 목록 반환.

### `app/api/google-calendar/subscribe/route.ts`
`POST /api/google-calendar/subscribe`  
Google 캘린더 → Calenber 구독 등록.  
`calendar_subscription_catalogs` + `calendar_subscription_installs` 생성,  
Google push watch 채널 등록, 초기 이벤트 동기화(syncToken 저장).

### `app/api/google-calendar/integration/route.ts`
`DELETE /api/google-calendar/integration`  
Google 계정 연결 해제. watch 채널 stop → catalog/install/integration 삭제.

### `app/api/google-calendar/events/route.ts`
- `GET` — 시간 범위로 이벤트 조회 (클라이언트 훅에서 사용)
- `POST` — 새 이벤트를 구글에 생성 (Calenber 이벤트 저장 시 병렬)
- `PATCH` — 구글 이벤트 수정 (gcal: 이벤트 편집 시)
- `DELETE` — 구글 이벤트 삭제 (gcal: 이벤트 삭제 시)

### `app/api/google-calendar/webhook/route.ts`
`POST /api/google-calendar/webhook`  
Google push 알림 수신 → 증분 동기화(syncToken) → Supabase Realtime broadcast → 클라이언트 re-fetch.

### `hooks/use-google-calendar-subscription-events.ts`
클라이언트 훅. 설치된 google_calendar 타입 카탈로그를 조회하고  
API 호출 → CalendarEvent 배열 반환. Realtime broadcast + 5분 polling fallback.

### `components/calendar/event-form.tsx`
이벤트 폼의 저장 분기 중심 컴포넌트.
- 일반 Calenber 이벤트 저장
- 구글 전용 일정 생성
- `gcal:` 구독 이벤트 수정
- `gcal:` 이벤트를 다른 구글 캘린더로 이동
- `gcal:` 이벤트를 로컬 Calenber 컬렉션으로 이동(구글 삭제 + 로컬 생성)

---

## 3. 데이터 타입

### Google API 타입 (`lib/google/calendar-api.ts`)

```typescript
type GoogleCalendarListEntry = {
    id: string
    summary: string
    description?: string
    backgroundColor?: string
    foregroundColor?: string
    primary?: boolean
    accessRole: "freeBusyReader" | "reader" | "writer" | "owner"
    selected?: boolean
    timeZone?: string
}

type GoogleCalendarEventDateTime = {
    date?: string       // 종일: "2026-05-01"
    dateTime?: string   // 시간 지정: "2026-05-01T10:00:00+09:00"
    timeZone?: string
}

type GoogleCalendarEvent = {
    id: string
    status: "confirmed" | "tentative" | "cancelled"
    summary?: string
    description?: string
    start: GoogleCalendarEventDateTime
    end: GoogleCalendarEventDateTime
    recurrence?: string[]
    recurringEventId?: string
    allDay?: boolean
    created?: string
    updated?: string
    colorId?: string
    attendees?: Array<{
        email: string
        displayName?: string
        responseStatus?: "needsAction" | "declined" | "tentative" | "accepted"
    }>
}

type GoogleWatchResponse = {
    kind: string
    id: string         // 채널 ID
    resourceId: string
    resourceUri: string
    token?: string
    expiration?: string  // ms since epoch as string
}
```

### OAuth 타입 (`lib/google/oauth.ts`)

```typescript
type GoogleTokenResponse = {
    access_token: string
    refresh_token?: string
    expires_in: number
    token_type: string
    scope: string
    id_token?: string
}

type GoogleUserInfo = {
    id: string
    email: string
    name: string | null
    picture: string | null
}
```

### Calenber 구독 타입 (`store/calendar-store.types.ts`)

```typescript
// Google 구독 카탈로그의 config 필드 구조 (DB jsonb)
type GoogleCalendarCatalogConfig = {
    provider: "google_calendar_v1"
    googleCalendarId: string
    googleAccountId: string
    syncToken?: string | null
    needsFullSync?: boolean
}

// 구독 카탈로그 아이템 (스토어에서 사용)
type CalendarSubscriptionCatalogItem = {
    id: string
    slug: string
    name: string
    sourceType: "google_calendar" | "shared_collection" | ...
    collectionColor: string | null
    status: "active" | "inactive"
    config?: Record<string, unknown>  // GoogleCalendarCatalogConfig
    // ...
}

// 이벤트에 붙는 구독 메타
type EventSubscriptionItem = {
    id: string
    name: string
    sourceType: string
    authority: "system" | "user"
    providerName: string
    calendar: { id: string | null; name: string | null; avatarUrl: string | null } | null
    googleEmail?: string | null
}
```

### 컬렉션 필드 옵션 타입 (`components/calendar/event-form-collection-field.tsx`)

```typescript
type EventFormCollectionMeta = {
    isGoogleCalendar?: boolean
    googleCatalogId?: string
    googleCalendarId?: string
    googleAccountId?: string
    collection?: CalendarEventCollection
}

type EventFormCollectionOption = EventChipsComboboxOption<EventFormCollectionMeta>
```

### 폼 내부 컬렉션 표현 (`components/calendar/event-form.tsx`)

```typescript
function getEventFormCollectionNames(event?: CalendarEvent): string[]
// 일반 이벤트: ["컬렉션명", ...]
// gcal 이벤트: ["__gcal__<catalogId>"]
```

- 구글 구독 이벤트를 열 때 폼은 `event.collections[0].name`을 그대로 쓰지 않는다.
- 대신 `parseGoogleCalendarEventId(event.id)` 결과로 `__gcal__<catalogId>` 값을 만들어 넣는다.
- 목적:
  1. 구글 구독 컬렉션과 동일 이름의 로컬 컬렉션이 중복 선택지처럼 보이지 않게 함
  2. `saveNow()`가 현재 선택이 "구글 유지"인지 "로컬 전환"인지 정확히 판별하게 함

---

## 4. 주요 함수 시그니처

### `lib/google/oauth.ts`

```typescript
// 스코프 상수
const GOOGLE_CALENDAR_SCOPES: readonly string[]           // full 인증 시 요청
const GOOGLE_CALENDAR_REQUIRED_SCOPES: readonly string[]  // 최소 필수
const GOOGLE_CALENDAR_WRITE_SCOPES: readonly string[]     // 쓰기 권한

function buildGoogleAuthUrl(params: {
    redirectUri: string
    state: string
    forceAccountSelect?: boolean
}): string

async function exchangeCodeForTokens(params: {
    code: string
    redirectUri: string
}): Promise<GoogleTokenResponse>

async function refreshAccessToken(refreshToken: string): Promise<{
    access_token: string
    expires_in: number
}>

async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo>

function normalizeGoogleScopes(scopes: string[] | string | null | undefined): string[]
function getMissingGoogleScopes(scopes: ..., requiredScopes: readonly string[]): string[]
```

### `lib/google/calendar-api.ts`

```typescript
async function getValidAccessToken(
    supabase: SupabaseClient,
    userId: string,
    googleAccountId: string
): Promise<string | null>

async function getValidAccessTokenWithScopes(
    supabase: SupabaseClient,
    userId: string,
    googleAccountId: string,
    requiredScopes?: readonly string[]
): Promise<{ token: string; missingScopes: string[] } | null>

async function listGoogleCalendars(accessToken: string): Promise<GoogleCalendarListEntry[]>

async function listGoogleCalendarEvents(
    accessToken: string,
    calendarId: string,
    options?: { timeMin?; timeMax?; syncToken?; pageToken?; maxResults? }
): Promise<GoogleCalendarEventsResponse>

async function fetchAllGoogleCalendarEvents(
    accessToken: string,
    calendarId: string,
    options: Omit<ListEventsOptions, "pageToken">
): Promise<{ events: GoogleCalendarEvent[]; nextSyncToken: string | undefined }>

async function createGoogleCalendarEvent(
    accessToken: string,
    calendarId: string,
    event: { summary; description?; start; end; recurrence? }
): Promise<GoogleCalendarEvent>

async function updateGoogleCalendarEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: Partial<{ summary; description?; start; end; recurrence? }>
): Promise<GoogleCalendarEvent>

async function deleteGoogleCalendarEvent(
    accessToken: string,
    calendarId: string,
    eventId: string
): Promise<void>

async function watchGoogleCalendar(
    accessToken: string,
    calendarId: string,
    params: { channelId; webhookUrl; expirationMs }
): Promise<GoogleWatchResponse>

async function stopGoogleCalendarWatch(
    accessToken: string,
    channelId: string,
    resourceId: string
): Promise<void>

class GoogleApiError extends Error  // status: number, body: string
class GoogleSyncTokenExpiredError extends Error  // syncToken 만료 시 throw
```

### `lib/google/calendar-event-mapper.ts`

```typescript
const GOOGLE_CALENDAR_EVENT_PREFIX = "gcal"

function makeGoogleCalendarEventId(catalogId: string, googleEventId: string): string
// returns: "gcal:<catalogId>:<googleEventId>"

function parseGoogleCalendarEventId(eventId: string): {
    catalogId: string
    googleEventId: string
} | null

function isGoogleCalendarEventId(eventId: string): boolean

function mapGoogleEventToCalendarEvent(
    googleEvent: GoogleCalendarEvent,
    options: {
        catalogId: string
        catalogName: string
        collectionColor?: string | null
        isLocked?: boolean
        subscriptionMeta: EventSubscriptionItem
    }
): CalendarEvent | null
```

### `components/calendar/event-form-collection-field.tsx`

```typescript
const GOOGLE_COLLECTION_OPTION_PREFIX = "__gcal__"

function makeGoogleCollectionOptionValue(catalogId: string): string
// returns: "__gcal__<catalogId>"

function parseGoogleCollectionOptionValue(value: string): string | null
// returns: catalogId or null

function isGoogleCollectionOptionValue(value: string): boolean

function buildEventFormCollectionComboboxOptions({
    eventCollections,
    selectedCollectionNames,
    getDraftCollectionColor,
}): EventFormCollectionOption[]

function buildGoogleCalendarCollectionOptions(
    googleCatalogs: CalendarSubscriptionCatalogItem[]
): EventFormCollectionOption[]

function getCollectionChipClassName(color: string | null | undefined): string
function renderCollectionLabelTag(
    option: EventFormCollectionOption,
    className: string
): ReactNode

// 메인 컴포넌트
function EventFormCollectionChipsField({
    value,            // collectionNames (일반: "이름", 구글: "__gcal__<catalogId>")
    onChange,
    eventCollections,
    getDraftCollectionColor,
    googleCalendarCatalogs?,
    disabled?,
    invalid?,
    portalContainer?,
    emptyText?,
    errors?,
    listVariant?,
})
```

### `components/calendar/event-form.tsx`

```typescript
function getEventFormCollectionNames(event?: CalendarEvent): string[]

function resolveParticipantsFromValues(
    sourceEvent: CalendarEvent,
    participantIds: string[]
): CalendarEventParticipant[]

function buildCollectionsFromNames(
    collectionNames: string[],
    collectionSource: CalendarEventCollection[]
): CalendarEvent["collections"]

function buildGoogleEventViewSnapshot(params: {
    sourceEvent: CalendarEvent
    targetCatalog: CalendarSubscriptionCatalogItem
    targetGoogleEventId: string
    values: EventFormValues
}): CalendarEvent
```

- `resolveParticipantsFromValues()`:
  폼의 `participantIds`를 실제 `CalendarEventParticipant[]`로 재구성.
  `gcal → local` 전환 시 새 로컬 이벤트 생성에도 사용된다.
- `buildCollectionsFromNames()`:
  일반 컬렉션 이름 배열을 실제 `CalendarEvent["collections"]` 구조로 변환.
  이미 존재하는 컬렉션은 재사용하고, 없으면 draft color 기준으로 새 구조를 만든다.
- `buildGoogleEventViewSnapshot()`:
  `gcal` 이벤트를 다른 구글 컬렉션으로 이동했을 때,
  새 `gcal:<targetCatalogId>:<newGoogleEventId>`를 가진 뷰 이벤트 스냅샷을 즉시 구성한다.

---

## 5. ID 패턴

| 패턴 | 예시 | 설명 |
|------|------|------|
| `gcal:<catalogId>:<googleEventId>` | `gcal:abc-123:xyz_event` | Google 구독 이벤트 ID. `parseGoogleCalendarEventId()`로 분해 |
| `__gcal__<catalogId>` | `__gcal__abc-123` | 폼 collectionNames 배열 내 구글 캘린더 옵션 값 |
| `sub:<calendarId>:<eventId>` | `sub:cal1:ev1` | 공유 컬렉션 구독 이벤트 ID |
| `subscription.<slug>.<...>` | `subscription.korean-public-holidays.2026-01-01` | 시스템 built-in 구독 이벤트 ID |

**판별 함수:**
```typescript
isGoogleCalendarEventId(id)       // gcal: 구독 이벤트
isGeneratedSubscriptionEventId(id) // subscription. 시스템 이벤트
isSubscriptionStyleEventId(id)     // sub: 공유 컬렉션 이벤트
isGoogleCollectionOptionValue(v)   // __gcal__ 폼 옵션 값
```

---

## 6. DB 스키마 (Google 관련 테이블)

### `user_google_integrations`
Google OAuth 연결 정보 저장.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `user_id` | uuid | Calenber 유저 ID |
| `google_account_id` | text | Google 계정 ID (sub) |
| `google_email` | text | Google 이메일 |
| `google_display_name` | text | Google 표시명 |
| `access_token` | text | OAuth 액세스 토큰 |
| `refresh_token` | text | OAuth 리프레시 토큰 |
| `token_expires_at` | timestamptz | 토큰 만료 시각 |
| `scopes` | text[] | 부여된 스코프 목록 |

PK: `(user_id, google_account_id)`

### `calendar_subscription_catalogs`
구독 카탈로그 (Google 포함 모든 구독 소스).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid | 카탈로그 ID |
| `slug` | text | 고유 식별자 (google: `google.<sha256-16>`) |
| `name` | text | 구독 이름 |
| `source_type` | text | `"google_calendar"` / `"shared_collection"` / ... |
| `collection_color` | text | 컬렉션 색상 |
| `owner_user_id` | uuid | 소유 유저 |
| `status` | text | `"active"` / `"inactive"` |
| `visibility` | text | `"private"` (Google 구독은 항상 private) |
| `config` | jsonb | `GoogleCalendarCatalogConfig` 참고 |

`config` 필드 구조 (google_calendar):
```json
{
  "provider": "google_calendar_v1",
  "googleCalendarId": "primary",
  "googleAccountId": "<google-user-id>",
  "syncToken": "<nextSyncToken>",
  "needsFullSync": false
}
```

### `calendar_subscription_installs`
카탈로그를 특정 Calenber 캘린더에 설치한 기록.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `calendar_id` | uuid | Calenber 캘린더 ID |
| `subscription_catalog_id` | uuid | 카탈로그 ID |
| `is_visible` | bool | 표시 여부 |
| `created_by` | uuid | 설치한 유저 |

PK: `(calendar_id, subscription_catalog_id)`

### `google_calendar_sync_channels`
Google push watch 채널 정보.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `channel_id` | text | Google 채널 UUID |
| `resource_id` | text | Google 리소스 ID (채널 해제 시 필요) |
| `subscription_catalog_id` | uuid | 연결된 카탈로그 |
| `google_calendar_id` | text | 대상 Google 캘린더 ID |
| `owner_user_id` | uuid | 소유 유저 |
| `expiration` | timestamptz | 채널 만료 시각 (최대 7일) |

---

## 7. 엔드-투-엔드 플로우

### 7-1. Google 계정 연결 (OAuth)
```
1. 사용자 클릭 → GET /api/google-calendar/auth
   → { url: "https://accounts.google.com/o/oauth2/v2/auth?..." }

2. 팝업 창으로 authUrl 열기
   → 사용자 Google 로그인 + 권한 동의

3. GET /api/google-calendar/callback?code=...&state=...
   → exchangeCodeForTokens() → getGoogleUserInfo()
   → user_google_integrations UPSERT
   → window.opener.postMessage({ type: "google-calendar-auth-success", email, accountId })
   → 팝업 닫기

4. 부모 창에서 postMessage 수신 → 연결된 계정 상태 업데이트
```

### 7-2. Google 캘린더 구독 등록
```
1. 다이얼로그: GET /api/google-calendar/list?accountId=... → 캘린더 목록 표시

2. 사용자 캘린더 선택 + POST /api/google-calendar/subscribe
   Body: { calendarId, googleAccountId, googleCalendarId, googleCalendarName, collectionColor }

3. 서버:
   a. 초기 이벤트 동기화 (fetchAllGoogleCalendarEvents, 1년 범위) → nextSyncToken 저장
   b. calendar_subscription_catalogs INSERT (slug: google.<hash>)
   c. calendar_subscription_installs UPSERT
   d. watchGoogleCalendar() → google_calendar_sync_channels INSERT
   → { catalogId, success: true }

4. 클라이언트: 스토어 revalidate → 구독 이벤트 표시
```

### 7-3. 구독 이벤트 표시 (클라이언트 훅)
```
use-google-calendar-subscription-events.ts:

1. subscriptionCatalogs에서 source_type="google_calendar" + installed 필터
2. 각 catalog마다:
   GET /api/google-calendar/events?catalogId&googleCalendarId&googleAccountId&timeMin&timeMax
   → GoogleCalendarEvent[] → mapGoogleEventToCalendarEvent() → CalendarEvent[]
3. Supabase Realtime 채널 구독:
   topic: "subscription:catalog:<catalogId>"
   event: "google.calendar.events.changed"
   → re-fetch
4. 5분 polling fallback
```

### 7-4. 구독 이벤트 수정
```
event-form.tsx saveNow():
  parseGoogleCalendarEventId(event.id) → { catalogId, googleEventId }
  selectedGoogleCatalogId = collectionNames에서 "__gcal__<catalogId>" 추출
  plainCollectionNames = 일반 컬렉션명만 추출

  if parsed && selectedGoogleCatalogId === catalogId && plainCollectionNames.length === 0:
    catalog = installedGoogleCalendarCatalogs.find(c => c.id === catalogId)
    config = catalog.config as { googleCalendarId, googleAccountId }
    PATCH /api/google-calendar/events
      { googleCalendarId, googleAccountId, googleEventId, title, start, end, allDay, timezone }
    return  ← Calenber에는 저장하지 않음
```

즉 `gcal` 이벤트를 열었을 때 기본 선택값도 `__gcal__<catalogId>`이며,
"같은 구글 컬렉션 유지" 상태에서만 PATCH 경로를 탄다.

### 7-4-1. 구독 이벤트를 다른 구글 컬렉션으로 이동
```
event-form.tsx saveNow():
  parseGoogleCalendarEventId(event.id) → { sourceCatalogId, googleEventId }
  selectedGoogleCatalogId !== sourceCatalogId 인 경우:

  1. POST /api/google-calendar/events
     { title, start, end, allDay, timezone, googleCatalogs: [targetCatalog] }
     → 새 googleEventId 반환

  2. DELETE /api/google-calendar/events
     { sourceGoogleCalendarId, sourceGoogleAccountId, googleEventId }

  3. buildGoogleEventViewSnapshot()으로
     id = gcal:<targetCatalogId>:<newGoogleEventId>
     인 새 viewEvent 구성

  4. setActiveEventId / setViewEvent / modal URL replace
```

효과:
- 원래 구글 일정은 삭제된다.
- 새 캘린더에 생성된 구글 일정이 현재 열린 이벤트가 된다.
- UI상 "두 개의 컬렉션"이 아니라 하나의 이동으로 동작한다.

### 7-4-2. 구독 이벤트를 로컬 Calenber 컬렉션으로 이동
```
event-form.tsx saveNow():
  parseGoogleCalendarEventId(event.id) → { sourceCatalogId, googleEventId }
  selectedGoogleCatalogId === null 이고 plainCollectionNames.length >= 0 인 경우:

  1. ensureEventCollections(plainCollectionNames)
  2. buildCollectionsFromNames(...)로 로컬 collections 구성
  3. createEvent(localEvent)
     - title/content/start/end/timezone/allDay/recurrence/exceptions/status 유지
     - participants도 resolveParticipantsFromValues()로 복원
  4. DELETE /api/google-calendar/events
     { sourceGoogleCalendarId, sourceGoogleAccountId, googleEventId }
  5. setActiveEventId / setViewEvent / modal URL replace
```

효과:
- 기존 구글 일정은 실제 Google Calendar에서 삭제된다.
- 동일 내용의 새 로컬 Calenber 이벤트가 생성된다.
- 사용자가 체감하는 동작은 "구글 컬렉션에서 내 컬렉션으로 이동"이다.

### 7-5. 구독 이벤트 삭제
```
use-delete-event.ts:
  parseGoogleCalendarEventId(id) → { catalogId, googleEventId }
  if parsed:
    catalog = subscriptionCatalogs.find(c => c.id === catalogId)
    DELETE /api/google-calendar/events
      { googleCalendarId, googleAccountId, googleEventId }
    toast.success / toast.error
    return  ← Calenber store deleteEvent()는 호출하지 않음
```

### 7-6. Calenber 일정을 구글에도 저장
```
event-form.tsx saveNow():
  collectionNames에서 isGoogleCollectionOptionValue(v) → googleCatalogId 추출
  if googleCatalogId && event.id가 일반 UUID:
    POST /api/google-calendar/events
      { eventId, title, start, end, allDay, timezone,
        googleCatalogs: [{ catalogId, googleCalendarId, googleAccountId }] }
    return  ← 구글 전용, Calenber에는 저장하지 않음
  else:
    일반 Calenber 저장 경로 (onChange patch)
```

주의:
- 일반 로컬 이벤트에서 구글 컬렉션을 선택하면 "구글에 새 일정 생성"이며 로컬 저장은 하지 않는다.
- 반대로 `gcal:` 이벤트에서 로컬 컬렉션을 선택하면 "구글 삭제 + 로컬 생성" 경로를 탄다.
- 즉 같은 컬렉션 UI를 공유하지만 저장 분기는 `event.id`가 `gcal:`인지 아닌지에 따라 다르다.

### 7-7. Webhook 수신 → 실시간 동기화
```
POST /api/google-calendar/webhook
  X-Goog-Channel-ID: <channelId>
  X-Goog-Resource-State: exists | not_exists

1. google_calendar_sync_channels에서 channelId → catalogId, googleCalendarId, ownerUserId
2. calendar_subscription_catalogs에서 config.syncToken 조회
3. fetchAllGoogleCalendarEvents(accessToken, googleCalendarId, { syncToken })
   → syncToken 만료(GoogleSyncTokenExpiredError) 시 config.needsFullSync = true 저장
4. nextSyncToken → config.syncToken 갱신
5. supabase.channel("subscription:catalog:<catalogId>").send({
     type: "broadcast",
     event: "google.calendar.events.changed",
     payload: { catalogId, occurredAt }
   })
6. 클라이언트 훅에서 re-fetch 트리거
```

### 7-8. Google 계정 연결 해제
```
DELETE /api/google-calendar/integration  { accountId }

1. user_google_integrations에서 access_token 조회
2. 해당 계정의 catalog IDs 조회
3. google_calendar_sync_channels에서 channel_id, resource_id 조회
4. stopGoogleCalendarWatch() 호출 (각 채널)
5. calendar_subscription_catalogs DELETE (→ cascade: installs, channels)
6. user_google_integrations DELETE
```

---

## 8. 컬렉션 선택 규칙 (UI)

`EventFormCollectionChipsField`에서 구글/일반 컬렉션을 하나의 combobox로 표시하되,
선택 상태에 따라 상호 배타 비활성화:

```
구글 캘린더 선택 시:
  → 일반 컬렉션 옵션 모두 disabledValues에 추가 (새로 선택 불가)
  → 구글 캘린더는 단일 선택 (prevGoogleValues 제외 후 최신 1개 유지)

일반 컬렉션 선택 시:
  → 구글 옵션 모두 disabledValues에 추가

아무것도 선택 안 됨:
  → 모두 활성 상태
```

`disabledValues`는 `EventChipsCombobox`의 `disabledValues?: Set<string>` prop으로 전달됨.  
비활성 아이템은 드롭다운에서 `opacity-40 pointer-events-none` 처리.

추가 규칙:
```
gcal 이벤트를 폼으로 열 때:
  → collectionNames 기본값은 "__gcal__<catalogId>" 하나만 들어간다
  → event.collections[0].name(구글 캘린더 이름)을 일반 컬렉션 값으로 사용하지 않는다
```

이유:
- 같은 이름의 로컬 컬렉션이 존재해도 "같은 컬렉션이 두 개"처럼 보이지 않게 하기 위함
- 사용자가 구글 컬렉션을 로컬 컬렉션으로 바꾸는 순간을 저장 로직에서 정확히 감지하기 위함

렌더링 규칙:
- 구글 컬렉션 option/chip도 일반 컬렉션과 같은 `collection_color` 기반 색상 태그를 사용한다.
- 드롭다운 목록에서만 보조 메타로 `Google Calendar` 텍스트와 아이콘을 붙여 출처를 표시한다.
- 즉 "구글 캘린더의 컬렉션 라벨"과 "폼에서 선택하는 컬렉션 칩"은 같은 이름/색 체계를 공유한다.

---

## 9. 환경변수

| 변수 | 용도 |
|------|------|
| `GOOGLE_CLIENT_ID` | OAuth 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | OAuth 클라이언트 시크릿 |
| `GOOGLE_CALENDAR_WEBHOOK_URL` | push watch 콜백 URL (`/api/google-calendar/webhook`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | webhook 핸들러에서 service role 사용 |

---

## 10. 주의 사항 및 엣지 케이스

- **syncToken 만료**: `GoogleSyncTokenExpiredError` → `config.needsFullSync = true` 저장. 다음 구독 로드 시 전체 재동기화 필요. 현재 자동 재동기화 로직은 미구현 — 사용자 재구독으로 처리.
- **webhook 채널 만료**: Google watch 채널은 최대 7일. 만료 후 push 중단, polling fallback 동작. 자동 채널 갱신 로직은 미구현.
- **gcal: 이벤트는 Calenber store에 없음**: `use-google-calendar-subscription-events` 훅이 인메모리로 반환. 삭제/수정 시 Google API 직접 호출 후 훅 re-fetch로 반영.
- **gcal 이벤트의 폼 초기값은 실제 컬렉션명이 아님**:
  표시 태그는 구글 캘린더 이름/색을 쓰지만, 폼 내부 값은 `__gcal__<catalogId>`다.
  이 덕분에 동일 이름의 로컬 컬렉션과 충돌하지 않는다.
- **`cancelled` 이벤트**: `mapGoogleEventToCalendarEvent()`와 GET 핸들러 모두에서 필터링. 표시하지 않음.
- **다중 계정**: `googleAccountId`로 계정별 토큰 독립 관리. `installedGoogleCalendarCatalogs` 필터도 계정별.
- **Calenber 저장 + 구글 저장 상호 배타**: 폼에서 구글 옵션 선택 시 일반 컬렉션 비활성화. `saveNow`에서 `googleCatalogId` 있으면 Calenber `onChange` 호출하지 않음.
- **gcal → local 전환은 update가 아니라 migrate에 가깝다**:
  기존 구글 일정을 PATCH로 "컬렉션 변경"하는 것이 아니라,
  로컬 이벤트를 새로 만들고 원래 Google 이벤트를 DELETE한다.
- **gcal → 다른 google_catalog 전환도 migrate다**:
  원본 Google 이벤트를 다른 캘린더로 직접 move하지 않고,
  대상 캘린더에 새로 만들고 원본을 삭제한다.
