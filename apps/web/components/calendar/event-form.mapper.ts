import { CalendarEvent } from "@/store/useCalendarStore"
import { nanoid } from "nanoid"
import { EventFormValues } from "./event-form.schema"

export function toCalendarEvent(values: EventFormValues): CalendarEvent {
    const now = Date.now()

    return {
        id: nanoid(),

        title: values.title,
        description: values.description,

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
        description: values.description,

        start: values.start.getTime(),
        end: values.end.getTime(),

        allDay: values.allDay,

        timezone: values.timezone,
        color: values.color,

        recurrence: values.recurrence,
        exceptions: values.exceptions,
    }
}
