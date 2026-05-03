# 알림 시스템 이해 가이드

> 이 문서는 운영 명세서가 아니라, "지금 우리 알림이 어떻게 움직이는지"를 사람이 이해하기 쉽게 설명하는 문서입니다.
> 자세한 구현 기준은 루트의 `NOTIFICATION_SPEC.md`를 봅니다.

## 1. 알림 시스템을 한 문장으로 말하면

우리 알림 시스템은 크게 두 부분으로 나뉩니다.

1. 앱 안에서 보이는 알림함 만들기
2. 바깥으로 보내는 알림 보내기

즉, "알림을 저장하는 것"과 "푸시/이메일을 실제 전송하는 것"을 분리해 둔 구조입니다.

이 분리가 중요한 이유는 다음과 같습니다.

- 앱 안 알림은 반드시 남아야 함
- 푸시/이메일은 실패할 수 있음
- 실패했을 때 재시도할 수 있어야 함
- 사용자가 앱을 열고 있지 않아도 보내져야 함

## 2. 알림이 어디서 시작되나

알림은 보통 두 군데에서 시작합니다.

### 1) 앱에서 직접 만드는 경우

예:

- 어떤 API가 "캘린더 가입 알림"을 직접 만들고 싶을 때
- 특정 동작 후 명시적으로 알림을 발생시키고 싶을 때

이때는 `/api/notifications/trigger`를 통해 알림을 만듭니다.

### 2) DB 변화에서 자동으로 만드는 경우

예:

- 일정 생성
- 일정 수정
- 일정 삭제

이런 건 `event_history`에 기록이 생기고, 그걸 DB trigger가 보고 자동으로 알림을 만듭니다.

중요한 점은, 시작점은 달라도 결국 같은 알림 파이프라인으로 들어간다는 것입니다.

## 3. 알림이 만들어질 때 실제로 생기는 것

알림 하나가 생기면 DB에서 보통 세 가지가 같이 움직입니다.

### 1) `notifications`

이건 "원본 알림 로그"입니다.

예를 들면:

- 누가
- 누구에게
- 어떤 일정에 대해
- 어떤 종류의 알림을
- 언제 만들었는지

가 한 줄로 저장됩니다.

쉽게 말하면 "알림 원장"입니다.

### 2) `notification_digests`

이건 앱 화면에서 바로 읽기 쉽게 정리한 "요약본"입니다.

왜 요약본이 필요하냐면, 알림 UI는 보통 이런 걸 빨리 알아야 하기 때문입니다.

- 지금 안 읽은 알림 몇 개인지
- 같은 종류 알림이 몇 번 쌓였는지
- 가장 최근 알림이 뭔지

원본 로그만 계속 읽으면 UI가 느려질 수 있으니, 읽기 전용 요약 테이블을 따로 둔 겁니다.

벨 아이콘 숫자와 알림 목록은 사실상 이 테이블을 기준으로 동작합니다.

### 3) `notification_delivery_queue`

이건 "바깥으로 보낼 일감 목록"입니다.

예:

- 이 알림은 push 보내야 함
- 이 알림은 email도 보내야 함
- 이 알림은 현재 보낼 채널이 없음

즉, 알림이 생기는 순간 바로 푸시를 쏘지 않고, 먼저 queue에 "이 알림을 나중에 전달해라"라고 넣어두는 구조입니다.

## 4. 왜 queue가 필요한가

이 부분이 가장 중요합니다.

예전에는 "알림 생성"과 "푸시 발송"이 너무 가깝게 붙어 있으면 다음 문제가 생깁니다.

- 푸시 서버가 잠깐 죽으면 알림 자체가 꼬임
- DB trigger에서 만든 알림은 푸시가 안 갈 수 있음
- 사용자가 브라우저를 안 열고 있으면 발송이 안 되는 구조가 생길 수 있음
- 실패했을 때 다시 보내기가 어려움

그래서 지금은:

1. 알림은 먼저 무조건 저장
2. 바깥 전송은 queue가 따로 담당

이렇게 나눠둔 상태입니다.

이 구조가 실무에서 훨씬 안정적입니다.

## 5. 푸시/이메일은 누가 실제로 보내나

실제 전송은 Supabase Edge Function인 `send-notification`이 담당합니다.

흐름은 이렇습니다.

1. queue에 새 job이 생김
2. DB trigger가 그 job을 보고 `pg_net`으로 Edge Function을 호출함
3. Edge Function이 job을 하나 집어서 처리함
4. push/email 발송 결과를 보고 job 상태를 마감함

즉, DB는 "보낼 일이 생겼다"까지만 결정하고, 실제 네트워크 전송은 Edge Function이 맡습니다.

## 6. 사용자가 앱에서 보는 알림은 어떻게 바로 바뀌나

이건 delivery queue와 별개입니다.

앱 화면 갱신은 `notification_digests`의 realtime 구독으로 처리합니다.

즉:

1. DB에서 digest row가 바뀜
2. Supabase Realtime이 그 변화를 브라우저로 보냄
3. `useNotificationRealtime()`가 그걸 받음
4. Zustand store가 즉시 갱신됨
5. 벨 숫자, 드롭다운, 알림 페이지가 바로 반영됨

그래서 "앱 안에서 보이는 알림"은 push 발송 성공 여부와 상관없이 바로 반영될 수 있습니다.

이건 좋은 구조입니다.

## 7. unreadCount는 어떻게 맞춰지나

안 읽은 개수는 주로 두 방식으로 맞춰집니다.

### 1) 실시간 반영

새 digest가 들어오면 store가 바로 합계를 다시 계산합니다.

### 2) 재동기화

앱이 다시 포커스를 얻거나 화면이 visible로 돌아오면
`get_unread_notification_count()`를 한 번 더 호출해 숫자를 맞춥니다.

이 재동기화가 있는 이유는, 실시간이 잠깐 끊기거나 브라우저 상태가 애매할 때 숫자가 틀어질 수 있기 때문입니다.

즉, 지금 구조는:

- 평소엔 realtime
- 혹시 드리프트 나면 focus sync로 복구

방식입니다.

## 8. "같은 알림이 두 번 생기지 않게"는 어떻게 막나

이전에는 API route에서 먼저 "최근 30초 안에 같은 알림이 있었나?"를 조회해서 막고 있었습니다.

문제는 이 방식이 동시 요청에 약하다는 점입니다.

예:

- 요청 A가 확인
- 요청 B가 확인
- 둘 다 아직 없다고 봄
- 둘 다 insert

이렇게 되면 중복 생성이 가능합니다.

지금은 이걸 DB 함수 `create_notification_if_absent(...)`로 옮겼습니다.

이 함수는:

1. `(recipient, actor, digest_key)` 기준 잠금을 잡고
2. 최근 같은 알림이 있는지 확인한 뒤
3. 없을 때만 생성합니다

즉, 중복 방지를 API 바깥이 아니라 DB 안에서 원자적으로 하도록 바뀐 상태입니다.

## 9. queue 상태는 무슨 뜻인가

`notification_delivery_queue.status`는 아래처럼 읽으면 됩니다.

### `pending`

아직 보낼 준비가 된 상태입니다.

### `processing`

Edge Function이 잡아서 처리 중입니다.

### `sent`

실제로 적어도 한 채널은 발송에 성공했습니다.

### `failed`

네트워크 오류나 처리 오류로 실패했습니다.
cron이 다시 시도할 수 있습니다.

### `noop`

처리는 했지만 지금은 보낼 채널이 없어서 보낼 게 없었습니다.

예:

- 유저가 push를 꺼둠
- 이메일도 꺼둠
- 구독이 만료되어 실제로 보낼 수 있는 endpoint가 없음

이건 시스템 에러가 아니라 "정상적으로 처리했지만 전송 대상 채널이 없음"에 가깝습니다.

## 10. 지금 구조에서 특히 좋은 점

### 1) 알림함과 외부 전송을 분리했다

이건 가장 큰 장점입니다.

앱 안 알림은 남기고, push/email는 비동기로 처리할 수 있습니다.

### 2) DB trigger 경로도 같은 파이프라인을 탄다

예전에는 API로 만든 알림만 푸시가 연결되고, DB trigger 기반 알림은 구멍이 생기기 쉬웠습니다.

지금은 둘 다 같은 queue를 타기 때문에 훨씬 일관적입니다.

### 3) 읽기 모델이 따로 있다

알림 목록/뱃지 용도로 `notification_digests`를 따로 둔 건 조회 효율과 UI 단순화에 큰 도움이 됩니다.

### 4) 재시도 경로가 있다

`pg_cron`이 pending/failed job을 다시 dispatch해 주기 때문에 일시적 실패에 더 강합니다.

## 11. 아직 기억해야 할 한계

### 1) extension/secret 설정이 빠지면 delivery가 안 돈다

필수 요소:

- `pg_net`
- `pg_cron`
- Vault secret 2개
- Edge secret 1개

이 중 빠지면 알림은 생성되지만 push/email delivery는 조용히 멈출 수 있습니다.

### 2) daily / weekly email digest는 아직 본격 구현 아님

설정값은 있지만, 실제 배치 digest 메일 시스템은 아직 아닙니다.

### 3) quiet hours는 아직 저장만 하고 실제 차단에는 쓰지 않는다

이유는 간단합니다.

- 현재 preference에는 조용한 시간만 있고
- 그 시간이 어느 타임존 기준인지 확실한 정보가 없습니다

이 상태에서 억지로 적용하면, 오히려 잘못된 시간대에 알림이 막혀 버릴 수 있습니다.

그래서 지금은 "잘못 막는 것"보다 "일단 보내는 것"이 안전하다고 보고 보수적으로 꺼둔 상태입니다.

### 4) 일부 알림 타입은 UI에는 보이지만 발생 경로가 아직 약할 수 있다

즉, 구조는 받아들일 준비가 됐지만 실제 producer wiring이 100% 끝난 건 아닐 수 있습니다.

## 12. 내가 코드를 볼 때 어디부터 보면 되나

### 전체 구조를 보고 싶을 때

- 루트의 `NOTIFICATION_SPEC.md`

### 앱 쪽 실시간 반영을 보고 싶을 때

- `apps/web/components/provider/notification-sync.tsx`
- `apps/web/hooks/use-notification-realtime.ts`
- `apps/web/store/useNotificationStore.ts`

### 알림 생성 진입점을 보고 싶을 때

- `apps/web/app/api/notifications/trigger/route.ts`
- `supabase/migrations/20260506200000_add_event_history_notification_trigger.sql`
- `supabase/migrations/20260506215000_scope_event_update_notification_recipients.sql`

### delivery queue를 보고 싶을 때

- `supabase/migrations/20260506230000_add_notification_delivery_queue.sql`
- `supabase/migrations/20260506240000_add_pg_net_notification_delivery_webhook.sql`
- `supabase/migrations/20260506250000_harden_notification_delivery_and_idempotency.sql`

### 실제 푸시/이메일 전송을 보고 싶을 때

- `supabase/functions/send-notification/index.ts`

## 13. 한 번에 이해하는 짧은 요약

지금 알림 시스템은 이렇게 생각하면 됩니다.

1. 이벤트가 생기면 알림 원본을 저장한다.
2. 화면용 요약 테이블도 같이 갱신한다.
3. 외부 발송용 queue도 같이 만든다.
4. DB가 Edge Function을 깨워서 push/email를 보낸다.
5. 브라우저는 digest realtime을 받아서 벨 숫자와 목록을 바로 갱신한다.

즉, "저장", "화면 반영", "외부 발송"이 각각 역할 분리된 구조입니다.
