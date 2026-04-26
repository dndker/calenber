const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const SUBSCRIPTION_EVENT_PREFIX = "subscription."

/**
 * 캘린더 DB RPC에서 안전하게 조회 가능한 이벤트 ID(UUID)인지 검사한다.
 */
export function isCalendarEventUuid(eventId: string) {
    return UUID_PATTERN.test(eventId)
}

/**
 * 동적 생성 구독 일정 ID인지 검사한다.
 * 예: subscription.kr.public-holidays:2026-03-02:삼일절 대체공휴일
 */
export function isGeneratedSubscriptionEventId(eventId: string) {
    return eventId.startsWith(SUBSCRIPTION_EVENT_PREFIX)
}
