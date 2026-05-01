import { getCalendarEventModalPath, getCalendarPath } from "@/lib/calendar/routes"
import type { NotificationDigest, NotificationType } from "@/store/notification-store.types"

/**
 * 집계 알림 텍스트 생성
 * 인스타그램 좋아요처럼 "A님 외 2명이 캘린더에 가입했습니다" 형식
 */
export function formatNotificationBody(
    digest: NotificationDigest,
    t: (key: string, params?: Record<string, string | number>) => string
): string {
    const { metadata, count, notificationType } = digest
    const primaryActor = metadata.actorName ?? t("notification.unknownUser")

    // 추가 actor 수 (primary 제외)
    const otherCount = Math.max(0, count - 1)

    const tKey = getNotificationTypeKey(notificationType)

    if (otherCount === 0) {
        return t(`notification.body.${tKey}.single`, { actor: primaryActor })
    }

    return t(`notification.body.${tKey}.multiple`, {
        actor: primaryActor,
        others: otherCount,
    })
}

/**
 * 알림 타입별 i18n 키 매핑
 */
function getNotificationTypeKey(type: NotificationType): string {
    const map: Record<NotificationType, string> = {
        calendar_joined: "calendarJoined",
        calendar_settings_changed: "calendarSettingsChanged",
        event_created: "eventCreated",
        event_updated: "eventUpdated",
        event_deleted: "eventDeleted",
        event_tagged: "eventTagged",
        event_participant_added: "eventParticipantAdded",
        event_comment_added: "eventCommentAdded",
        event_comment_replied: "eventCommentReplied",
        event_reaction: "eventReaction",
    }
    return map[type] ?? type
}

/**
 * 알림 아바타 소스 결정
 * - 캘린더 관련: calendarAvatarUrl
 * - 유저 행동: actorAvatarUrl
 */
export type NotificationAvatarSource =
    | { type: "calendar"; url: string | null; name: string | null }
    | { type: "user"; url: string | null; name: string | null }

export function resolveNotificationAvatar(
    digest: NotificationDigest
): NotificationAvatarSource {
    const { notificationType, metadata } = digest

    switch (notificationType) {
        case "calendar_settings_changed":
            return {
                type: "calendar",
                url: metadata.calendarAvatarUrl ?? null,
                name: metadata.calendarName ?? null,
            }
        default:
            return {
                type: "user",
                url: metadata.actorAvatarUrl ?? null,
                name: metadata.actorName ?? null,
            }
    }
}

/**
 * 알림 클릭 시 이동할 경로
 */
export function resolveNotificationHref(digest: NotificationDigest): string {
    const { entityType, entityId, calendarId } = digest

    if (entityType === "calendar" && calendarId) {
        return getCalendarPath(calendarId)
    }
    if (entityType === "event" && calendarId) {
        return getCalendarEventModalPath(calendarId, entityId)
    }
    return "/notifications"
}
