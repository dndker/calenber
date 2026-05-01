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

/** 공유 카테고리 구독 일정 `sub:<catalogUuid>:<sourceEventUuid>` */
const SUBSCRIPTION_COMPOSITE_PATTERN =
    /^sub:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}):([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i

export function parseSubscriptionCompositeEventId(eventId: string): {
    catalogId: string
    sourceEventId: string
} | null {
    const match = eventId.match(SUBSCRIPTION_COMPOSITE_PATTERN)
    if (!match) {
        return null
    }

    return {
        catalogId: match[1]!,
        sourceEventId: match[2]!,
    }
}

/** 공유 카테고리 구독 일정 ID (`sub:…`) */
export function isSubscriptionCompositeEventId(eventId: string): boolean {
    return parseSubscriptionCompositeEventId(eventId) !== null
}

/** 공휴일/절기 생성 ID 또는 공유 구독 복합 ID */
export function isSubscriptionStyleEventId(eventId: string): boolean {
    return (
        isGeneratedSubscriptionEventId(eventId) ||
        isSubscriptionCompositeEventId(eventId)
    )
}

/**
 * Google 캘린더 구독 이벤트 ID(`gcal:<catalogId>:<googleEventId>`)인지 검사한다.
 * isSubscriptionStyleEventId와 달리 편집/삭제가 가능한 이벤트다.
 */
export function isGoogleCalendarSubscriptionEventId(eventId: string): boolean {
    return eventId.startsWith("gcal:")
}
