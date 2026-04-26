# 캘린더 구독 기능 인수인계 문서

작성일: 2026-04-27  
대상: 다음 작업을 이어받을 개발자/AI

## 1) 현재 상태 요약

- 구독(Subscription) 아키텍처로 전환 완료 (`plugin` -> `subscription`).
- 구독 카탈로그/설치 상태를 DB(Supabase) 기반으로 로딩하도록 전환됨.
- 대한민국 공휴일 구독은 동적 생성 방식이며 읽기 전용 이벤트로 동작.
- 구독 이벤트(비 UUID ID) 클릭 시 UUID RPC 에러가 나던 문제 해결됨.
  - 비 UUID 이벤트는 상세 RPC/히스토리 RPC를 우회.
  - 구독 이벤트는 폼 수정 불가(읽기 전용).
- 모달/공유 URL 토큰 체계는 최근 단축/통일 작업이 들어간 상태.
  - 링크 토큰 파싱 회귀 이슈 1회 발생 후 수정됨.

## 2) 질문: "구독한 카테고리가 바뀌면 내 캘린더도 실시간 반영되는가?"

현재 기준 결론:

- **시스템 공휴일 구독**: 원본 카테고리 개념이 없고 생성 규칙 기반이므로 "원본 변경 실시간 반영" 시나리오가 사실상 없음.
- **공유 카테고리/공유 캘린더 구독(shared_category/shared_calendar)**:
  - 구조/스키마는 일부 준비되어 있으나,
  - "원본 카테고리 변경(이름/색/가시성 등) -> 구독자 캘린더 실시간 반영"은 **완성되지 않음**.

즉, 이 기능은 **다음 작업으로 구현 필요**.

권장 구현 방향:

1. 원본 변경 이벤트를 Supabase Realtime 채널로 구독.
2. 구독 설치 맵(`calendar_subscription_installs`)과 카탈로그(`calendar_subscription_catalogs`)를 기준으로 영향 대상 계산.
3. 구독자 측 store를 patch(upsert)하고 필요한 뷰만 재렌더.
4. 오프라인/지연 복구를 위해 주기적 재동기화(fetch + diff)도 함께 둠.

## 3) 다음 핵심 작업: 카테고리 공유 UI + RPC

## 3-1. 목표

- 사용자가 특정 카테고리를 "공유 가능한 구독 소스"로 발행.
- 다른 사용자가 구독 검색/설치 후 본인 캘린더에서 읽기/필터링 가능.
- 원본 카테고리 변경이 구독자에게 반영되며, 권한/RLS 안전성 보장.

## 3-2. 백엔드(RPC/DB) 해야 할 일

- `shared_category` 타입 구독 소스 생성 RPC
  - 입력: `calendar_id`, `category_id`, `name/description`, 공개 범위
  - 출력: catalog row
- 카탈로그 조회 RPC 보강
  - 검색/정렬/상태(`active/source_deleted/archived`) 일관화
- 설치/해제 RPC(또는 기존 install 테이블 로직 보강)
  - 중복 설치 방지, 트랜잭션 처리
- 실시간 반영용 조회 RPC
  - 특정 구독에서 실제 이벤트/카테고리 스냅샷을 가져오는 API
- RLS 정책 점검
  - 발행자만 수정/삭제 가능
  - 구독자는 설치된 소스만 조회 가능

## 3-3. 프론트엔드(UI) 해야 할 일

- 카테고리 설정 영역에 "공유(발행)" 액션 추가
- 구독 관리자(`calendar-subscription-manager`)에서
  - `shared_category` 구독 카드 노출
  - 설치/해제/숨김/상태 뱃지 처리
- 설치 후 캘린더 필터/사이드바에서 출처가 보이도록 개선
- 원본 삭제/권한 소멸 시 상태 메시지(`원본 삭제됨`) 명확화

## 3-4. 완료 기준(Definition of Done)

- 발행 -> 검색 -> 설치 -> 캘린더 반영 end-to-end 동작.
- 원본 카테고리 이름/색 변경 시 구독자 화면 반영.
- 원본 삭제 시 `source_deleted` 상태 전환 + 사용자 안내 표시.
- 타입체크/기본 동작 테스트 통과.

## 4) 추가 Next Up (우선순위 권장)

- P1: `shared_category` 실제 이벤트/카테고리 동기화 로직 완성
- P1: `source_deleted` UI 배지/문구 전면 반영(목록 + 상세)
- P1: URL 토큰 체계 최종 정리
  - 신규/레거시 파서 통합 테스트 추가
  - 공유 링크 생성/해석 규칙 문서화
- P2: 이전/다음 일정 이동 prefetch(hover/idle 시 다음 상세 선로딩)
- P2: 성능 계측(실사용 기준)
  - modal open latency
  - prev/next 전환 latency
  - subscription merge 렌더 비용
- P3: 운영 문서화
  - 구독 소스 lifecycle(생성/설치/삭제/삭제됨 상태)
  - 장애 대응(runbook)

## 5) 빠른 검증 체크리스트

- 구독 공휴일 클릭 시 상세 모달이 열리고 읽기 전용인지
- 구독 이벤트에서 drag/resize가 불가능한지
- 모달 URL 토큰으로 진입해도 상세가 정상 노출되는지
- 이전/다음 일정 이동 시 체감 지연이 줄었는지
- 타입체크 통과 (`bun run typecheck`)

## 6) 참고 파일(핵심)

- `apps/web/components/calendar-subscription-manager.tsx`
- `apps/web/hooks/use-calendar-subscriptions.ts`
- `apps/web/hooks/use-calendar-subscription-events.ts`
- `apps/web/lib/calendar/subscriptions/providers/korean-public-holidays.ts`
- `apps/web/lib/calendar/queries.ts`
- `apps/web/components/calendar/event-modal.tsx`
- `apps/web/hooks/use-calendar-event-detail.ts`
- `apps/web/components/calendar/event-form.tsx`
- `supabase/migrations/*subscription*`

