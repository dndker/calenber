import type { SupabaseClient } from "@supabase/supabase-js"
import type {
    UserNotificationPreferences,
    NotificationType,
} from "@/store/notification-store.types"

// ─────────────────────────────────────────
// 알림 읽음 처리
// ─────────────────────────────────────────

/**
 * 특정 digest_key 목록을 읽음 처리한다.
 * null을 넘기면 전체 읽음 처리.
 */
export async function markNotificationsRead(
    supabase: SupabaseClient,
    digestKeys: string[] | null
): Promise<void> {
    const { error } = await supabase.rpc("mark_notifications_read", {
        p_digest_keys: digestKeys,
    })
    if (error) throw error
}

// ─────────────────────────────────────────
// 알림 환경설정 저장 (upsert)
// ─────────────────────────────────────────

type PreferencesPatch = Partial<
    Pick<
        UserNotificationPreferences,
        | "pushEnabled"
        | "emailEnabled"
        | "typeSettings"
        | "emailDigest"
        | "quietHours"
    >
>

export async function saveNotificationPreferences(
    supabase: SupabaseClient,
    userId: string,
    patch: PreferencesPatch
): Promise<void> {
    const dbRow: Record<string, unknown> = { user_id: userId }

    if (patch.pushEnabled !== undefined) dbRow.push_enabled = patch.pushEnabled
    if (patch.emailEnabled !== undefined) dbRow.email_enabled = patch.emailEnabled
    if (patch.typeSettings !== undefined) dbRow.type_settings = patch.typeSettings
    if (patch.emailDigest !== undefined) dbRow.email_digest = patch.emailDigest
    if (patch.quietHours !== undefined) dbRow.quiet_hours = patch.quietHours

    const { error } = await supabase
        .from("user_notification_preferences")
        .upsert(dbRow, { onConflict: "user_id" })

    if (error) throw error
}

// ─────────────────────────────────────────
// Push 구독 등록 / 삭제
// ─────────────────────────────────────────

export async function savePushSubscription(
    supabase: SupabaseClient,
    userId: string,
    subscription: PushSubscription,
    deviceLabel?: string
): Promise<void> {
    const json = subscription.toJSON()
    const { error } = await supabase.from("push_subscriptions").upsert(
        {
            user_id: userId,
            endpoint: subscription.endpoint,
            p256dh: json.keys?.p256dh ?? "",
            auth_key: json.keys?.auth ?? "",
            device_label: deviceLabel ?? null,
            expires_at: subscription.expirationTime
                ? new Date(subscription.expirationTime).toISOString()
                : null,
        },
        { onConflict: "user_id,endpoint" }
    )
    if (error) throw error
}

export async function deletePushSubscription(
    supabase: SupabaseClient,
    endpoint: string
): Promise<void> {
    const { error } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", endpoint)
    if (error) throw error
}

// ─────────────────────────────────────────
// 알림 트리거 (서버 API Route에서 호출 — service_role 필요)
// 클라이언트에서 직접 사용하지 말고 /api/notifications/trigger 를 통해 호출
// ─────────────────────────────────────────

export type TriggerNotificationPayload = {
    recipientIds: string[]
    actorId: string | null
    notificationType: NotificationType
    entityType: "calendar" | "event" | "comment" | "reaction"
    entityId: string
    calendarId?: string
    metadata?: Record<string, unknown>
}
