import { parseEventContent } from "@/lib/calendar/event-content"
import type { CalendarEvent } from "@/store/calendar-store.types"

export type CalendarEventRecord = {
    id: string
    title: string
    content: CalendarEvent["content"] | string | null
    start_at: string | null
    end_at: string | null
    status: CalendarEvent["status"] | null
    created_by: string | null
    updated_by: string | null
    is_locked: boolean | null
    created_at: string
    updated_at: string | null
    creator_name: string | null
    creator_email: string | null
    creator_avatar_url: string | null
    updater_name: string | null
    updater_email: string | null
    updater_avatar_url: string | null
}

export function mapCalendarEventRecordToCalendarEvent(
    event: CalendarEventRecord
): CalendarEvent {
    const start = event.start_at
        ? new Date(event.start_at).valueOf()
        : Date.now()
    const end = event.end_at ? new Date(event.end_at).valueOf() : start

    return {
        id: event.id,
        title: event.title,
        content: parseEventContent(event.content),
        start,
        end,
        allDay: true,
        timezone: "Asia/Seoul",
        color: "#3b82f6",
        status: event.status ?? "scheduled",
        authorId: event.created_by,
        author: event.created_by
            ? {
                  id: event.created_by,
                  name: event.creator_name,
                  email: event.creator_email,
                  avatarUrl: event.creator_avatar_url,
              }
            : null,
        updatedById: event.updated_by,
        updatedBy: event.updated_by
            ? {
                  id: event.updated_by,
                  name: event.updater_name,
                  email: event.updater_email,
                  avatarUrl: event.updater_avatar_url,
              }
            : null,
        isLocked: event.is_locked ?? false,
        createdAt: new Date(event.created_at).valueOf(),
        updatedAt: new Date(event.updated_at ?? event.created_at).valueOf(),
    }
}
