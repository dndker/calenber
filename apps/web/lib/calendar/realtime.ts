import type { CalendarEventRecord } from "@/lib/calendar/event-record"

export const CALENDAR_WORKSPACE_REALTIME_EVENTS = {
    created: "calendar.event.created",
    updated: "calendar.event.updated",
    deleted: "calendar.event.deleted",
} as const

export const CALENDAR_WORKSPACE_REALTIME_RETRY_DELAYS_MS = [
    1_000,
    2_500,
    5_000,
    10_000,
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

export type CalendarWorkspacePresencePayload = {
    id: string
    displayName: string
    avatarUrl: string | null
    isAnonymous: boolean
    joinedAt: string
}
