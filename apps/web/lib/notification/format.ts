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
    return buildNotificationBodyText(digest)
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

export function buildNotificationBodyText(
    digest: NotificationDigest,
    locale = "ko"
): string {
    const { notificationType, metadata, count } = digest
    const actor = metadata.actorName ?? (locale === "ko" ? "알 수 없는 사용자" : "Unknown user")
    const others = Math.max(0, count - 1)
    const isKo = locale === "ko"
    const eventTitle = metadata.title?.trim() || (isKo ? "제목 없는 일정" : "Untitled event")
    const calendarName = metadata.calendarName?.trim() || (isKo ? "캘린더" : "calendar")

    function withOthers(single: string, multi: (n: number) => string): string {
        return others === 0 ? single : multi(others)
    }

    switch (notificationType) {
        case "calendar_joined":
            return withOthers(
                isKo
                    ? `${actor}님이 ${calendarName}에 가입했습니다`
                    : `${actor} joined ${calendarName}`,
                (n) =>
                    isKo
                        ? `${actor}님 외 ${n}명이 ${calendarName}에 가입했습니다`
                        : `${actor} and ${n} others joined ${calendarName}`
            )
        case "calendar_settings_changed":
            return withOthers(
                isKo
                    ? `${actor}님이 ${calendarName} 설정을 변경했습니다`
                    : `${actor} updated settings for ${calendarName}`,
                (n) =>
                    isKo
                        ? `${actor}님 외 ${n}명이 ${calendarName} 설정을 변경했습니다`
                        : `${actor} and ${n} others updated settings for ${calendarName}`
            )
        case "event_created":
            return isKo
                ? `${actor}님이 ${calendarName}에 ${eventTitle} 일정을 추가했습니다`
                : `${actor} created ${eventTitle} in ${calendarName}`
        case "event_updated":
            return isKo
                ? `${actor}님이 ${calendarName}의 ${eventTitle} 일정을 수정했습니다`
                : `${actor} updated ${eventTitle} in ${calendarName}`
        case "event_deleted":
            return isKo
                ? `${actor}님이 ${calendarName}의 ${eventTitle} 일정을 삭제했습니다`
                : `${actor} deleted ${eventTitle} from ${calendarName}`
        case "event_tagged":
            return isKo
                ? `${actor}님이 ${calendarName}의 ${eventTitle} 일정에서 회원님을 언급했습니다`
                : `${actor} mentioned you in ${eventTitle} from ${calendarName}`
        case "event_participant_added":
            return isKo
                ? `${actor}님이 ${calendarName}의 ${eventTitle} 일정에 회원님을 초대했습니다`
                : `${actor} invited you to ${eventTitle} in ${calendarName}`
        case "event_comment_added":
            return isKo
                ? `${actor}님이 ${calendarName}의 ${eventTitle} 일정에 댓글을 남겼습니다`
                : `${actor} commented on ${eventTitle} in ${calendarName}`
        case "event_comment_replied":
            return isKo
                ? `${actor}님이 ${calendarName}의 ${eventTitle} 일정 댓글에 답글을 남겼습니다`
                : `${actor} replied in ${eventTitle} from ${calendarName}`
        case "event_reaction":
            return isKo
                ? `${actor}님이 ${calendarName}의 ${eventTitle} 일정에 반응을 남겼습니다`
                : `${actor} reacted to ${eventTitle} in ${calendarName}`
        default:
            return isKo ? "새 알림이 있습니다" : "New notification"
    }
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
