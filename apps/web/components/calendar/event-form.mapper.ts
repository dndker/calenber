import type { CalendarEvent } from "@/store/calendar-store.types"
import { randomCalendarCategoryColor } from "@/lib/calendar/category-color"
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
        categoryIds: [],
        categories: values.categoryNames.map((name) => ({
            id: "",
            calendarId: "",
            name: name.trim(),
            options: {
                visibleByDefault: true,
                color: randomCalendarCategoryColor(),
            },
            createdById: null,
            createdAt: now,
            updatedAt: now,
        })),
        categoryId: null,
        category: null,

        recurrence: values.recurrence,

        exceptions: values.exceptions,
        participants: [],

        status: "scheduled",
        authorId: null,
        author: null,
        updatedById: null,
        updatedBy: null,
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
        categoryIds: [],
        categories: values.categoryNames.map((name) => ({
            id: "",
            calendarId: "",
            name: name.trim(),
            options: {
                visibleByDefault: true,
                color: randomCalendarCategoryColor(),
            },
            createdById: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        })),
        category: null,
        categoryId: null,
        participants: [],

        recurrence: values.recurrence,
        exceptions: values.exceptions,

        status: values.status,
    }
}
