/**
 * 알림 트리거 유틸
 *
 * 캘린더·일정 뮤테이션 훅에서 호출한다.
 * 실제 DB 삽입은 /api/notifications/trigger 를 통해 서버에서 service_role 로 처리.
 *
 * 중복 방지 전략:
 *  - debounce 기반 입력 수정에는 "변경 완료" 시점을 명확히 정의하기 어렵기 때문에
 *    클라이언트에서 트리거하지 않고 Supabase DB Trigger(event_history 기반) 방식을 권장.
 *  - 여기서는 명시적 액션(가입, 참가자 추가 등)에 사용한다.
 */

import type { TriggerNotificationPayload } from "./mutations"

/**
 * 알림 트리거 요청을 서버 API Route 로 전송한다.
 * 실패해도 UX를 방해하지 않도록 에러는 console.error 로만 처리한다.
 */
export async function triggerNotification(
    payload: TriggerNotificationPayload
): Promise<void> {
    try {
        const res = await fetch("/api/notifications/trigger", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })
        if (!res.ok) {
            console.error("[notification] trigger failed", await res.text())
        }
    } catch (err) {
        console.error("[notification] trigger error", err)
    }
}

// ─────────────────────────────────────────
// 편의 함수 — 각 이벤트별 페이로드 생성
// ─────────────────────────────────────────

export function buildCalendarJoinedPayload(opts: {
    recipientIds: string[]
    actorId: string
    calendarId: string
    calendarName: string
    calendarAvatarUrl?: string | null
    actorName: string
    actorAvatarUrl?: string | null
}): TriggerNotificationPayload {
    return {
        recipientIds: opts.recipientIds,
        actorId: opts.actorId,
        notificationType: "calendar_joined",
        entityType: "calendar",
        entityId: opts.calendarId,
        calendarId: opts.calendarId,
        metadata: {
            title: opts.calendarName,
            calendarName: opts.calendarName,
            calendarAvatarUrl: opts.calendarAvatarUrl ?? undefined,
            actorName: opts.actorName,
            actorAvatarUrl: opts.actorAvatarUrl ?? undefined,
        },
    }
}

export function buildCalendarSettingsChangedPayload(opts: {
    recipientIds: string[]
    actorId: string
    calendarId: string
    calendarName: string
    calendarAvatarUrl?: string | null
    actorName: string
}): TriggerNotificationPayload {
    return {
        recipientIds: opts.recipientIds,
        actorId: opts.actorId,
        notificationType: "calendar_settings_changed",
        entityType: "calendar",
        entityId: opts.calendarId,
        calendarId: opts.calendarId,
        metadata: {
            title: opts.calendarName,
            calendarName: opts.calendarName,
            calendarAvatarUrl: opts.calendarAvatarUrl ?? undefined,
            actorName: opts.actorName,
        },
    }
}

export function buildEventCreatedPayload(opts: {
    recipientIds: string[]
    actorId: string
    calendarId: string
    calendarName: string
    eventId: string
    eventTitle: string
    eventStart?: string
    eventAllDay?: boolean
    actorName: string
    actorAvatarUrl?: string | null
}): TriggerNotificationPayload {
    return {
        recipientIds: opts.recipientIds,
        actorId: opts.actorId,
        notificationType: "event_created",
        entityType: "event",
        entityId: opts.eventId,
        calendarId: opts.calendarId,
        metadata: {
            title: opts.eventTitle,
            calendarName: opts.calendarName,
            actorName: opts.actorName,
            actorAvatarUrl: opts.actorAvatarUrl ?? undefined,
            eventStart: opts.eventStart,
            eventAllDay: opts.eventAllDay,
        },
    }
}

export function buildEventUpdatedPayload(opts: {
    recipientIds: string[]
    actorId: string
    calendarId: string
    eventId: string
    eventTitle: string
    actorName: string
    actorAvatarUrl?: string | null
    changedFields?: string[]
    previousTitle?: string
}): TriggerNotificationPayload {
    return {
        recipientIds: opts.recipientIds,
        actorId: opts.actorId,
        notificationType: "event_updated",
        entityType: "event",
        entityId: opts.eventId,
        calendarId: opts.calendarId,
        metadata: {
            title: opts.eventTitle,
            actorName: opts.actorName,
            actorAvatarUrl: opts.actorAvatarUrl ?? undefined,
            changedFields: opts.changedFields,
            previousTitle: opts.previousTitle,
        },
    }
}

export function buildEventTaggedPayload(opts: {
    recipientId: string
    actorId: string
    calendarId: string
    eventId: string
    eventTitle: string
    actorName: string
    actorAvatarUrl?: string | null
}): TriggerNotificationPayload {
    return {
        recipientIds: [opts.recipientId],
        actorId: opts.actorId,
        notificationType: "event_tagged",
        entityType: "event",
        entityId: opts.eventId,
        calendarId: opts.calendarId,
        metadata: {
            title: opts.eventTitle,
            actorName: opts.actorName,
            actorAvatarUrl: opts.actorAvatarUrl ?? undefined,
        },
    }
}

export function buildEventParticipantAddedPayload(opts: {
    recipientId: string
    actorId: string
    calendarId: string
    eventId: string
    eventTitle: string
    actorName: string
}): TriggerNotificationPayload {
    return {
        recipientIds: [opts.recipientId],
        actorId: opts.actorId,
        notificationType: "event_participant_added",
        entityType: "event",
        entityId: opts.eventId,
        calendarId: opts.calendarId,
        metadata: {
            title: opts.eventTitle,
            actorName: opts.actorName,
        },
    }
}
