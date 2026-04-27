import type { CalendarEventRecord } from "@/lib/calendar/event-record"

export const CALENDAR_WORKSPACE_REALTIME_EVENTS = {
    created: "calendar.event.created",
    updated: "calendar.event.updated",
    deleted: "calendar.event.deleted",
    categoryCreated: "calendar.event-category.created",
    categoryUpdated: "calendar.event-category.updated",
    categoryDeleted: "calendar.event-category.deleted",
    settingsUpdated: "calendar.settings.updated",
    cursorUpdated: "calendar.cursor.updated",
    cursorSnapshotRequested: "calendar.cursor.snapshot.requested",
    cursorSnapshotResponded: "calendar.cursor.snapshot.responded",
} as const

export const CALENDAR_WORKSPACE_REALTIME_RETRY_DELAYS_MS = [
    1_000, 2_500, 5_000, 10_000, 20_000, 30_000,
] as const

export const CALENDAR_WORKSPACE_REALTIME_RECOVERABLE_STATUSES = [
    "CHANNEL_ERROR",
    "CLOSED",
    "TIMED_OUT",
] as const

export type CalendarWorkspaceRealtimeStatus =
    | "SUBSCRIBED"
    | "CHANNEL_ERROR"
    | "CLOSED"
    | "TIMED_OUT"

export function getCalendarWorkspaceTopic(calendarId: string) {
    return `calendar:${calendarId}:workspace`
}

export type CalendarEventRealtimePayload = {
    entity: "event"
    operation: "insert" | "update" | "delete"
    calendarId: string
    eventId: string
    occurredAt: string
    record?: (Partial<CalendarEventRecord> & { id: string }) | null
}

export type CalendarEventCategoryRealtimePayload = {
    entity: "event_category"
    operation: "insert" | "update" | "delete"
    calendarId: string
    categoryId: string
    occurredAt: string
    record?: {
        id: string
        calendar_id: string
        name: string
        options: {
            visibleByDefault?: boolean
            color?: string
        } | null
        created_by: string | null
        created_at: string
        updated_at: string
    } | null
}

export type CalendarSettingsRealtimePayload = {
    entity: "calendar_settings"
    operation: "update"
    calendarId: string
    occurredAt: string
    record?: {
        id: string
        name: string
        avatar_url: string | null
        access_mode: "public_open" | "public_approval" | "private"
        event_layout: "compact" | "split"
        event_field_settings: unknown
        layout_options: unknown
        updated_at: string | null
    } | null
}

export type CalendarWorkspacePresencePayload = {
    id: string
    userId: string | null
    displayName: string
    avatarUrl: string | null
    isAnonymous: boolean
    joinedAt: string
    /**
     * 마지막으로 presence를 서버에 갱신한 시각입니다.
     * 브라우저 종료/네트워크 단절에서 leave 이벤트가 누락될 때 stale 멤버를 정리하는 기준으로 씁니다.
     */
    lastSeenAt?: string
    cursor?: CalendarWorkspaceCursor | null
}

export type CalendarWorkspaceCursor = {
    date: string // ISO (2026-04-17)
    type: "cell" | "event"
    eventId?: string
}

export type CalendarWorkspaceCursorBroadcastPayload = {
    id: string
    userId: string | null
    cursor: CalendarWorkspaceCursor | null
    occurredAt: string
}

export type CalendarWorkspaceCursorSnapshotRequestPayload = {
    requesterId: string
    occurredAt: string
}

export type CalendarWorkspaceCursorSnapshotResponsePayload = {
    targetId: string
    id: string
    userId: string | null
    cursor: CalendarWorkspaceCursor | null
    occurredAt: string
}
