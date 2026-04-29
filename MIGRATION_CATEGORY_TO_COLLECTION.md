# Category → Collection 마이그레이션 매핑표 (breaking rename)

이 문서는 기존 `category`(legacy) 용어/스키마를 **`collection`으로 완전 통일**하기 위한 “단일 소스”다.
DB 스키마/컬럼/RPC/코드 타입/문구가 서로 어긋나면 런타임 오류가 나기 쉬우므로, 변경은 반드시 이 매핑을 기준으로 진행한다.

## 1) DB 스키마 매핑

### 테이블
- `public.event_categories` → `public.event_collections`
- `public.event_category_assignments` → `public.event_collection_assignments`

### 컬럼
- `public.events.category_id` → `public.events.primary_collection_id`
- `public.calendar_subscription_catalogs.source_category_id` → `public.calendar_subscription_catalogs.source_collection_id`

### 인덱스/제약/RLS/트리거 (이름도 함께 정리)
- `*_category_*` 접두/중간 토큰을 `*_collection_*`로 변경
- FK 이름/unique/index/trigger/policy 이름이 실제 테이블/컬럼과 불일치하지 않게 재생성

## 2) Supabase RPC 매핑

### 이벤트 컬렉션 CRUD
- `public.upsert_calendar_event_category(...)` → `public.upsert_calendar_event_collection(...)`
- `public.get_calendar_event_categories(calendar_id)` → `public.get_calendar_event_collections(calendar_id)`
- `public.delete_calendar_event_category(category_id)` → `public.delete_calendar_event_collection(collection_id)`

### 이벤트에 컬렉션 할당
- `public.get_event_categories_json(event_id, ...)` → `public.get_event_collections_json(event_id, ...)`
- `public.replace_calendar_event_categories(event_id, category_ids[])`
  → `public.replace_calendar_event_collections(event_id, collection_ids[])`

### shared collection 구독(기존 shared_category)
- `calendar_subscription_catalogs.source_type` 값
  - `shared_category` → `shared_collection`
- `publish_collection_as_subscription(target_category_id, ...)`
  - 파라미터/검증/slug 모두 `collection` 기반으로 변경
- `get_shared_collection_subscription_events(...)`
  - 반환: `category_id/name/color` → `collection_id/name/color`
- `get_collection_publish_status(...)`
  - 반환: `category_id` → `collection_id` (+ 관련 조인/필터도 컬렉션 기준)

## 3) Web 타입/상태 매핑 (apps/web)

### 주요 타입 rename
- `CalendarEventCategory` → `CalendarEventCollection`
- `CalendarEventCategorySummary` → `CalendarEventCollectionSummary`
- `CalendarEventFilterState.excludedCategoryIds` → `excludedCollectionIds`

### CalendarEvent 필드 rename
- `categoryIds` → `collectionIds`
- `categories` → `collections`
- `categoryId` → `primaryCollectionId`
- `category` → `primaryCollection`

### subscription sourceType rename
- `CalendarSubscriptionSourceType`:
  - `shared_category` → `shared_collection`

### DB row / RPC row 키 rename
- `category_id` → `collection_id`
- `category_name` → `collection_name`
- `category_color` → `collection_color`

## 4) UI/문구 매핑

- 사용자 노출 문구(토스트/레이블/히스토리 요약)에서 “카테고리” → “컬렉션”
- 파일/컴포넌트 이름도 동일 규칙 적용
  - 예: `event-form-category-field` → `event-form-collection-field`
  - 예: `event-category-settings-panel` → `event-collection-settings-panel`

## 5) 리스크/주의

- DB 물리 rename은 **Web 배포와 같은 릴리즈로 묶어서** 진행해야 한다.
- Supabase 함수 반환 스키마 변경 시 `drop function if exists ...` 후 재작성(42P13 방지).
- Realtime payload / PostgREST 키가 `category_*`를 더 이상 내보내지 않도록, RPC/쿼리/파서가 함께 바뀌어야 한다.

