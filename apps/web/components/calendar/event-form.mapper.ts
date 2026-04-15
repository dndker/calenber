import { CalendarEvent } from "@/store/useCalendarStore"
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

        createdAt: now,
        updatedAt: now,
    }
}

export function mapToEvent(
    values: EventFormValues
): Omit<CalendarEvent, "id" | "createdAt" | "updatedAt"> {
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
    }
}
