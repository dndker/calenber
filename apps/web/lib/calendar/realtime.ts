import type { CalendarEventRecord } from "@/lib/calendar/event-record"

export const CALENDAR_WORKSPACE_REALTIME_EVENTS = {
    created: "calendar.event.created",
    updated: "calendar.event.updated",
    deleted: "calendar.event.deleted",
} as const

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
