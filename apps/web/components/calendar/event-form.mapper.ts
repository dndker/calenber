import type { CalendarEvent } from "@/store/calendar-store.types"
import { EventFormValues } from "./event-form.schema"

export function toCalendarEvent(values: EventFormValues): CalendarEvent {
    const now = Date.now()

    return {
        id: crypto.randomUUID(),

        title: values.title,
        content: values.content,

        start: values.start.getTime(),
        end: values.end.getTime(),

        allDay: values.allDay,

        timezone: values.timezone,
        color: values.color,

        recurrence: values.recurrence,

        exceptions: values.exceptions,

        status: "scheduled",
        authorId: null,
        author: null,
        isLocked: false,
        createdAt: now,
        updatedAt: now,
    }
}

export function mapToEvent(values: EventFormValues): Partial<CalendarEvent> {
    return {
        title: values.title,
        content: values.content,

        start: values.start.getTime(),
        end: values.end.getTime(),

        allDay: values.allDay,

        timezone: values.timezone,
        color: values.color,

        recurrence: values.recurrence,
        exceptions: values.exceptions,

        status: values.status,
    }
}
