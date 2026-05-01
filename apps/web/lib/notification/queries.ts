import type { SupabaseClient } from "@supabase/supabase-js"
import type {
    NotificationDigest,
    NotificationEntityType,
    NotificationMetadata,
    NotificationEmailDigest,
    NotificationType,
    UserNotificationPreferences,
} from "@/store/notification-store.types"

// ─────────────────────────────────────────
// DB Row → 도메인 모델 매핑
// ─────────────────────────────────────────

type NotificationDigestRow = {
    digest_key: string
    count: number
    unread_count: number
    actor_ids: string[]
    last_occurred_at: string
    notification_id: string
    notification_type: string
    entity_type: string
    entity_id: string
    calendar_id: string | null
    metadata: NotificationMetadata
    is_read: boolean
    created_at: string
}

async function withTimeout<T>(
    promise: PromiseLike<T>,
    timeoutMs = 8000
): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined

    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timer = setTimeout(() => {
                    reject(new Error("Notification request timed out"))
                }, timeoutMs)
            }),
        ])
    } finally {
        if (timer) {
            clearTimeout(timer)
        }
    }
}

export function mapNotificationDigestRow(row: NotificationDigestRow): NotificationDigest {
    return {
        digestKey: row.digest_key,
        count: row.count,
        unreadCount: row.unread_count,
        actorIds: row.actor_ids ?? [],
        lastOccurredAt: new Date(row.last_occurred_at).valueOf(),
        notificationId: row.notification_id,
        notificationType: row.notification_type as NotificationType,
        entityType: row.entity_type as NotificationEntityType,
        entityId: row.entity_id,
        calendarId: row.calendar_id,
        metadata: row.metadata ?? {},
        isRead: row.is_read,
        createdAt: new Date(row.created_at).valueOf(),
    }
}

type NotificationPreferencesRow = {
    user_id: string
    push_enabled: boolean
    email_enabled: boolean
    type_settings: Partial<Record<NotificationType, boolean>>
    email_digest: string
    quiet_hours: { start: string; end: string } | null
}

export function mapNotificationPreferencesRow(
    row: NotificationPreferencesRow
): UserNotificationPreferences {
    return {
        userId: row.user_id,
        pushEnabled: row.push_enabled,
        emailEnabled: row.email_enabled,
        typeSettings: row.type_settings ?? {},
        emailDigest: row.email_digest as NotificationEmailDigest,
        quietHours: row.quiet_hours,
    }
}

// ─────────────────────────────────────────
// 알림 목록 조회 (RPC: get_notifications)
// ─────────────────────────────────────────

export async function fetchNotifications(
    supabase: SupabaseClient,
    options: {
        limit?: number
        cursor?: string | null
        unreadOnly?: boolean
    } = {}
): Promise<{ digests: NotificationDigest[]; hasMore: boolean }> {
    const { limit = 30, cursor = null, unreadOnly = false } = options

    const { data, error } = await withTimeout(
        supabase.rpc("get_notifications", {
            p_limit: limit + 1, // +1로 hasMore 확인
            p_cursor: cursor ?? undefined,
            p_unread_only: unreadOnly,
        })
    )

    if (error) throw error

    const rows = (data ?? []) as NotificationDigestRow[]
    const hasMore = rows.length > limit
    const digests = rows.slice(0, limit).map(mapNotificationDigestRow)

    return { digests, hasMore }
}

// ─────────────────────────────────────────
// 읽지 않은 수 조회
// ─────────────────────────────────────────

export async function fetchUnreadNotificationCount(
    supabase: SupabaseClient
): Promise<number> {
    const { data, error } = await withTimeout(
        supabase.rpc("get_unread_notification_count"),
        5000
    )
    if (error) throw error
    return (data as number) ?? 0
}

// ─────────────────────────────────────────
// 알림 환경설정 조회
// ─────────────────────────────────────────

export async function fetchNotificationPreferences(
    supabase: SupabaseClient
): Promise<UserNotificationPreferences | null> {
    const { data, error } = await supabase
        .from("user_notification_preferences")
        .select("*")
        .single()

    if (error) {
        if (error.code === "PGRST116") return null // no rows
        throw error
    }

    return mapNotificationPreferencesRow(data as NotificationPreferencesRow)
}
