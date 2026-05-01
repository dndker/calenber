import type { NotificationDigest, NotificationEntityType, NotificationMetadata, NotificationType } from "@/store/notification-store.types"

/** Supabase realtime postgres_changes 행 타입 */
export type NotificationDigestRealtimeRow = {
    recipient_id: string
    digest_key: string
    latest_notification_id: string | null
    count: number
    actor_ids: string[]
    unread_count: number
    last_occurred_at: string
    notification_type: string | null
    entity_type: string | null
    entity_id: string | null
    calendar_id: string | null
    metadata: NotificationMetadata | null
    is_read: boolean
    created_at: string | null
    updated_at: string
}

/**
 * Realtime postgres_changes 이벤트를 NotificationDigest 도메인 모델로 변환
 */
export function mapRealtimeDigestRow(
    row: NotificationDigestRealtimeRow
): NotificationDigest {
    return {
        digestKey: row.digest_key,
        count: row.count,
        unreadCount: row.unread_count,
        actorIds: row.actor_ids ?? [],
        lastOccurredAt: new Date(row.last_occurred_at).valueOf(),
        notificationId: row.latest_notification_id ?? row.digest_key,
        notificationType: row.notification_type as NotificationType,
        entityType: row.entity_type as NotificationEntityType,
        entityId: row.entity_id ?? "",
        calendarId: row.calendar_id,
        metadata: row.metadata ?? {},
        isRead: row.unread_count === 0 || row.is_read,
        createdAt: new Date(
            row.created_at ?? row.last_occurred_at
        ).valueOf(),
    }
}

/** Realtime 채널 이름 */
export function getNotificationRealtimeTopic(userId: string): string {
    return `notifications:${userId}`
}
