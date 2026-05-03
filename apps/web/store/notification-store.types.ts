// ============================================================
// 알림 시스템 도메인 타입 — 단일 소스
// ============================================================

// ─────────────────────────────────────────
// 알림 종류
// ─────────────────────────────────────────
export const notificationTypes = [
    "calendar_joined",           // 캘린더 가입
    "calendar_settings_changed", // 캘린더 설정 변경
    "event_created",             // 일정 생성
    "event_updated",             // 일정 수정
    "event_deleted",             // 일정 삭제
    "event_tagged",              // 일정에 태그됨
    "event_participant_added",   // 일정 참가자로 추가됨
    "event_comment_added",       // (미래) 댓글
    "event_comment_replied",     // (미래) 답글
    "event_reaction",            // (미래) 반응
] as const

export type NotificationType = (typeof notificationTypes)[number]

// ─────────────────────────────────────────
// 연결 엔티티 종류
// ─────────────────────────────────────────
export type NotificationEntityType = "calendar" | "event" | "comment" | "reaction"

// ─────────────────────────────────────────
// 알림 메타데이터 (렌더링에 필요한 스냅샷)
// ─────────────────────────────────────────
export type NotificationMetadata = {
    /** 일정 또는 캘린더 제목 */
    title?: string
    /** 캘린더 이름 */
    calendarName?: string
    /** 캘린더 아바타 URL */
    calendarAvatarUrl?: string
    /** 발신자(actor) 이름 */
    actorName?: string
    /** 발신자 아바타 URL */
    actorAvatarUrl?: string
    /** 일정 시작 시간 (ISO) */
    eventStart?: string
    /** 일정 종료 시간 (ISO) */
    eventEnd?: string
    /** 일정 allDay 여부 */
    eventAllDay?: boolean
    /** 변경된 필드 목록 (event_updated 용) */
    changedFields?: string[]
    /** 이전 제목 (event_updated + title 변경 시) */
    previousTitle?: string
}

// ─────────────────────────────────────────
// 알림 집계 행 (notification_digests)
// ─────────────────────────────────────────
export type NotificationDigest = {
    /** 집계 키: "{type}:{entityType}:{entityId}" */
    digestKey: string
    /** 집계된 총 알림 수 */
    count: number
    /** 읽지 않은 수 */
    unreadCount: number
    /** actor id 목록 (최대 5개, 표시용) */
    actorIds: string[]
    /** 마지막 발생 시각 */
    lastOccurredAt: number

    // 대표 알림 정보
    notificationId: string
    notificationType: NotificationType
    entityType: NotificationEntityType
    entityId: string
    calendarId: string | null
    metadata: NotificationMetadata
    isRead: boolean
    createdAt: number
}

// ─────────────────────────────────────────
// 알림 채널 설정
// ─────────────────────────────────────────
export type NotificationEmailDigest = "realtime" | "daily" | "weekly" | "off"

/**
 * 유저 알림 환경설정
 * DB: user_notification_preferences
 */
export type UserNotificationPreferences = {
    userId: string
    pushEnabled: boolean
    emailEnabled: boolean
    /** 타입별 on/off: Record<NotificationType, boolean> */
    typeSettings: Partial<Record<NotificationType, boolean>>
    emailDigest: NotificationEmailDigest
    /** 조용한 시간대 (UTC): { start: "23:00", end: "07:00" } */
    quietHours: { start: string; end: string } | null
}

// ─────────────────────────────────────────
// Zustand 스토어 상태 & 액션
// ─────────────────────────────────────────
export type NotificationStoreState = {
    // ── 상태 ─────────────────────────────
    /** 집계된 알림 목록 (최신순) */
    digests: NotificationDigest[]
    /** 읽지 않은 총 수 */
    unreadCount: number
    /** 다음 페이지 커서 (last_occurred_at ISO) */
    nextCursor: string | null
    /** 더 불러올 데이터 있는지 */
    hasMore: boolean
    /** 목록 로딩 중 */
    isLoading: boolean
    /** 초기 로드 완료 여부 */
    isInitialized: boolean
    /** 알림 환경설정 */
    preferences: UserNotificationPreferences | null

    // ── 액션 ─────────────────────────────
    /** 알림 목록 첫 로드 */
    loadNotifications: () => Promise<void>
    /** 앱 진입 시 배지/드롭다운용 경량 preload */
    primeNotifications: () => Promise<void>
    /** 추가 페이지 로드 */
    loadMoreNotifications: () => Promise<void>
    /** Realtime으로 새 digest 수신 시 병합 */
    upsertDigest: (digest: NotificationDigest) => void
    /** 특정 digest_key 읽음 처리 */
    markRead: (digestKeys: string[]) => Promise<void>
    /** 전체 읽음 처리 */
    markAllRead: () => Promise<void>
    /** 환경설정 로드 */
    loadPreferences: () => Promise<void>
    /** 환경설정 저장 */
    savePreferences: (patch: Partial<UserNotificationPreferences>) => Promise<void>
    /** 읽지 않은 수 동기화 */
    syncUnreadCount: () => Promise<void>
}
