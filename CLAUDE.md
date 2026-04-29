# Calenber — Claude 작업 기준

구글 스프레드시트처럼 실시간으로 동작하고 유저 프레즌스까지 볼 수 있는 Notion 스타일 캘린더 서비스.

---

## 1. 실행 도구 — Bun 우선

모든 패키지 설치·스크립트·테스트·빌드는 Bun을 사용한다. `npm`, `pnpm`, `yarn`, `npx`, `node`, `vite`는 특별한 이유 없이 쓰지 않는다.

| 작업 | 명령 |
|------|------|
| 패키지 설치 | `bun install` |
| 스크립트 실행 | `bun run <script>` |
| 패키지 실행 | `bunx <package> <command>` |
| 파일 실행 | `bun <file>` (not `node`, not `ts-node`) |
| 테스트 | `bun test` |
| 타입 체크 | `bun run typecheck` (`tsc --noEmit`) |
| 빌드 | `bun build <file>` |

- Bun은 `.env`를 자동 로드하므로 `dotenv`를 사용하지 않는다.
- 작업 마무리 단계에서는 **반드시** `bun run typecheck`를 실행해 타입 회귀를 확인한다.

---

## 2. 프로젝트 구조

```
calenber/                  ← 모노레포 루트 (Turborepo)
├── apps/
│   ├── web/               ← 캘린더 서비스 (Next.js + TypeScript + shadcn/ui)
│   │   ├── app/           ← Next.js App Router 페이지
│   │   ├── components/    ← UI 컴포넌트 (calendar/, icon/ 등)
│   │   ├── hooks/         ← React 훅
│   │   ├── lib/calendar/  ← 캘린더 도메인 로직
│   │   │   ├── mutations.ts
│   │   │   ├── queries.ts
│   │   │   ├── realtime.ts
│   │   │   └── subscriptions/
│   │   │       ├── registry.ts
│   │   │       └── providers/   ← 공휴일·절기 등 built-in 구독
│   │   └── store/         ← Zustand 스토어
│   └── docs/              ← 문서 사이트 (Fumadocs)
└── packages/
    ├── ui/                ← 공유 shadcn/ui 컴포넌트
    ├── lib/               ← 공유 유틸리티
    └── types/             ← 공유 타입
```

작업 시 대상 앱의 역할과 기술 스택에 맞는 방식으로만 구현한다.

### 캘린더 도메인 타입 — 단일 소스와 계층 (정리 기준)

앱·구독·일정의 **표준 도메인 모델**은 한 파일에 모은다. 변경 시 여기부터 수정하고, 매핑 레이어(queries / event-record / hooks)와 UI를 따라간다.

| 역할 | 위치 | 내용 |
|------|------|------|
| **도메인 단일 소스** | `apps/web/store/calendar-store.types.ts` | `CalendarEvent`, `CalendarEventCollection`, `CalendarEventFilterState`, `CalendarSubscriptionDefinition`, `EventSubscriptionItem`, `CalendarStoreState` 및 스토어 액션 시그니처, `calendarEventFieldIds`·`CalendarEventFieldId` 등 |
| **컬렉션 색 팔레트** | `apps/web/lib/calendar/collection-color.ts` | `CalendarCollectionColor`, `calendarCollectionColors`, 정규화·클래스명 헬퍼 (레거시 파일명 `category-color` 아님) |
| **좁은 UI 타입** | `apps/web/lib/calendar/types.ts` | 예: `CalendarEventLayout` 등 폼·레이아웃 전용 |
| **Realtime 클라이언트 타입** | `apps/web/lib/calendar/realtime.ts` | 워크스페이스 채널명 상수, 브로드캐스트 페이로드 타입 (와이어 레거시 키는 타입 주석·필드명으로 명시) |
| **Postgres 행 → CalendarEvent** | `apps/web/lib/calendar/event-record.ts` | `CalendarEventRecord`(snake·DB/RPC 키), `mapCalendarEventRecordToCalendarEvent` |
| **Supabase 쿼리 결과 / 캘린더 메타** | `apps/web/lib/calendar/queries.ts` | `CalendarSummary`, `CalendarMembership`, `MyCalendarItem` 등 — 스토어 타입이 re-export·참조 |
| **필드 설정·로컬스토리지** | `apps/web/lib/calendar/event-field-settings.ts` | `CalendarEventFieldSettings`; 저장 JSON에 남은 필드 id `categories` → 런타임에서 `collections`로 마이그레이션 |

- **이름 규칙**: 컬렉션 엔티티는 `CalendarEventCollection`; 일정은 `collectionIds` / `collections` / `primaryCollectionId` / `primaryCollection`; 필터는 `excludedCollectionIds` 등 **collection** 접두·복수형을 쓴다.
- **DB·RPC 키 매핑표**는 저장소 루트 `MIGRATION_CATEGORY_TO_COLLECTION.md` §3를 본다 (스네이크·RPC 응답 키와의 대응).
- **`packages/types`**: 캘린더 도메인 전용 공유 패키지는 두지 않고, **`apps/web` 도메인 타입을 단일 소스**로 둔다.

---

## 3. 기본 작업 원칙

- 임시 대응보다 근본 원인 해결을 우선한다.
- 변경 영향도를 확인하고 회귀 가능성을 줄이는 방향으로 구현한다.
- 리뷰 가능한 구조와 일관된 네이밍을 유지한다.
- 전체 프로젝트의 구조와 톤에서 벗어나지 않게 작업한다.
- 책임이 다른 로직은 한 파일·한 함수에 과도하게 뭉치지 않도록 나눈다.
- 여러 곳에서 재사용되는 변수·함수·헬퍼·유틸은 공통 영역으로 분리한다.
- 공통 유틸과 복잡한 로직은 이해에 도움이 되도록 주석을 충분히 작성한다. 함수 인자·옵션 의미가 에디터에서 바로 확인되도록 JSDoc을 남긴다.

---

## 4. React 렌더링 원칙 (필수 체크)

실시간 다중 유저 캘린더 특성상 렌더링 안정성이 매우 중요하다.

- 불필요한 리렌더를 줄이도록 상태·이펙트·파생값 구조를 신중히 설계한다.
- `useEffect` 안에서 동기적으로 `setState`를 호출해 연쇄 렌더가 발생하는지 **항상** 점검한다.
  - `Error: Calling setState synchronously within an effect can trigger cascading renders` — 이 패턴은 무조건 제거한다.
- 과한 메모이제이션도 경계한다. `useMemo`·`useCallback`은 실제 병목이 확인된 곳에만 쓴다.
- Realtime 구독(Supabase channel)은 컴포넌트 마운트/언마운트 시 정확히 구독·해제되는지 확인한다.
- 성능 최적화는 마지막에 덧붙이는 작업이 아니라 구현 단계부터 고려한다.

---

## 5. 실시간 (Realtime) 작업 규칙

이 서비스는 구글 스프레드시트처럼 실시간으로 동작하며 유저 프레즌스(cursor, online 여부)를 지원한다.

- Realtime 로직은 `apps/web/lib/calendar/realtime.ts`와 `hooks/use-calendar-workspace-realtime.ts`에 집중한다.
- 채널 구독은 컴포넌트가 아닌 훅 또는 스토어 레이어에서 관리한다.
- Optimistic update → realtime 이벤트 수신 → 로컬 상태 reconcile 흐름을 유지한다.
- 이미 로컬에서 반영된 변경이 realtime으로 다시 들어와 중복 적용되지 않도록 event id / version 체크를 유지한다.
- 유저 프레즌스 정보는 무거운 상태 갱신을 트리거하지 않도록 별도 채널·별도 상태로 분리한다.

---

## 6. 캘린더 구독 도메인 규칙

### 타입 구조 일관성 (필수)
- 구독의 캘린더 메타는 플랫 필드로 분산하지 말고 `calendar` 객체로 유지한다.
- 표준 형태: `calendar: { id: string | null; name: string | null; avatarUrl: string | null } | null`
- `CalendarSubscriptionDefinition`과 `EventSubscriptionItem`은 동일한 구독 메타 구조를 공유한다.
- 신규 필드 추가 시 `store types → queries 매핑 → hooks attachMeta → UI` 순서로 전체 반영한다.

### 공휴일·절기 구독 — DB 비의존 원칙 (필수)
- `korean-public-holidays`, `korean-solar-terms`는 DB 이벤트가 아니라 provider 코드에서 동적 생성한다.
- Built-in 구독은 카탈로그 병합 시 DB 행이 없어도 동작해야 한다.
- 이벤트 조회·표시 로직은 생성형 구독 ID(`isGeneratedSubscriptionEventId`)를 항상 고려한다.
- 즐겨찾기·상세 조회에서 DB 미존재 이벤트가 누락되지 않도록 provider 기반 복원 경로를 유지한다.

### UI·폼 동작 (필수)
- 구독 일정은 일반 일정과 편집 가능 범위가 다르다.
- 이벤트 폼·사이드바 HoverCard 등 속성 표시 제한이 필요한 UI는 구독 일정에서 `schedule`, `collections`만 노출한다.
- 구독 일정의 삭제·일부 액션 제한 여부를 UI별로 일관되게 유지한다.

### 컬렉션 네이밍 — `category` 레거시 (필수)
- 도메인 표준 용어는 **컬렉션(collection)** 이다. 변수·함수·파일명·주석에는 `collection` / `collections` / `primaryCollection` 등을 쓴다.
- DB·RPC와 맞춘 이름: `event_collections`, `event_collection_assignments`, `events.primary_collection_id`, 구독 카탈로그 `source_collection_id`, `source_type = 'shared_collection'` 등.
- **의도적 레거시(건드릴 때만 정리)**  
  - `apps/web/lib/calendar/category-color.ts`: 팔레트 모듈명·`CalendarCategoryColor` 등 — 모듈 단위로 `collection-color`로 옮길 때 일괄 치환.  
  - 저장된 일정 필드 설정에 예전 필드 id `categories`가 있으면 로드 시 `collections`로 읽기(`lib/calendar/event-field-settings.ts`의 마이그레이션).  
  - 워크스페이스 Realtime 페이로드는 클라이언트 호환을 위해 `entity: event_category`, 채널명 `calendar.event-category.*`, JSON 키 `categoryId` 등을 **유지할 수 있음** — 실제 타입·파서는 `lib/calendar/realtime.ts` / `use-calendar-workspace-realtime.ts`를 따른다.
- 신규 코드에서 사용자 노출·식별자에 `category` / `categories`를 추가하지 않는다.

### 공휴일 네이밍 (필수)
- 설날 3일 중 당일만 `설날`, 전/후일은 `설날 연휴`로 표기한다.
- 대체공휴일 이름 포맷: `대체공휴일(원래명)` — 예: `대체공휴일(삼일절)`

### 놓치기 쉬운 체크리스트
- 구독 source calendar avatar는 카탈로그 조회 후 source calendar id 기반 추가 조회로 채운다.
- Built-in 구독 slug/id 정합성이 깨지면 설치·표시·provider 매칭이 동시에 깨진다.
- 타입 변경 시 `event.subscription` 참조 컴포넌트들을 함께 점검한다.

---

## 7. UI/UX 원칙

이 캘린더는 Notion 스타일을 일부 채택한다.

- 별도 지시가 없으면 기존 화면과 비슷한 톤·밀도를 유지한다.
- 주변 레이아웃과 컴포넌트를 함께 보고 일관된 스타일로 맞춘다.
- shadcn/ui 컴포넌트를 우선 활용하고, 커스텀이 필요한 경우 `packages/ui`에 공통 컴포넌트로 분리한다.
- 사용자 입장에서 놓치기 쉬운 흐름·상태·예외 케이스까지 고려한다.
- 과한 실험보다 신뢰감 있고 완성도 높은 방향을 우선한다.

---

## 8. i18n 키 네이밍 규칙

번역 키는 `domain.section.meaning` 3단계 구조로 작성한다. 모든 키는 **camelCase**로 쓴다.

### 구조 규칙

| 레벨 | 역할 | 예시 |
|------|------|------|
| `domain` | 기능 영역 | `common`, `auth`, `calendar`, `event`, `settings` |
| `section` | 도메인 내 구분 | `actions`, `form`, `views`, `navigation` |
| `meaning` | 텍스트 의미 | `title`, `placeholder`, `label`, `description` |

### 금지 패턴

- 4단계 이상 중첩 금지 — `event.form.title.placeholder` (X) → `event.form.titlePlaceholder` (O)
- snake_case 금지 — `event.form.title_placeholder` (X)
- 동사로 시작하는 섹션 금지 — `event.getTitle` (X) → `event.form.title` (O)

### 자주 쓰는 meaning 단어

- UI 요소: `title`, `description`, `label`, `placeholder`, `hint`, `badge`, `tooltip`
- 동작: `submit`, `cancel`, `confirm`, `delete`, `edit`, `add`, `back`
- 상태: `loading`, `empty`, `error`, `success`
- 타이틀/설명 패턴: 화면 제목 → `*.title`, 설명 → `*.description`

### 파일 위치

- 번역 파일: `apps/web/messages/{locale}.json` (현재 `ko.json`, `en.json`)
- 두 파일의 키 구조는 항상 동일하게 유지한다 — ko.json에 키를 추가하면 en.json에도 동시에 추가한다.

### 사용 패턴

```typescript
// 클라이언트
const t = useTranslations("event.form")
t("title")            // event.form.title

// 서버
const t = await getTranslations("event.form")
t("titlePlaceholder") // event.form.titlePlaceholder
```

---

## 9. Supabase 마이그레이션 규칙

- 기존 RPC(함수)를 **수정**할 때는 반드시 `drop function if exists` 후 `create or replace function` 순서로 작성한다.
  - PostgreSQL은 반환 타입(OUT 파라미터 포함)이 바뀌면 `create or replace`만으로 교체가 불가능하다(`42P13` 에러).
  - 수정 여부와 관계없이 항상 `drop function if exists public.<name>(<arg types>);`를 먼저 쓴다.
- `grant execute` 등 권한 부여 구문도 DROP 후 재작성 시 함께 포함한다.

---

## 9. 최종 검증 체크리스트

구현 후 아래를 순서대로 확인한다.

1. `bun run typecheck` — 타입 에러 없음
2. `useEffect` 내 동기 `setState` 패턴 — 없음
3. Realtime 채널 구독·해제 — 누수 없음
4. 구독 도메인 타입 변경 시 → store → queries → hooks → UI 전체 반영
5. 주요 사용자 흐름(이벤트 생성·수정·삭제·구독) 동작 확인
