import { parseEventContent } from "@/lib/calendar/event-content"
import { normalizeCalendarCategoryColor } from "@/lib/calendar/category-color"
import type { CalendarEvent } from "@/store/calendar-store.types"

export type CalendarEventRecord = {
    id: string
    calendar_id: string
    title: string
    content: CalendarEvent["content"] | string | null
    start_at: string | null
    end_at: string | null
    categories: CalendarEvent["categories"] | null
    category_id: string | null
    category_name: string | null
    category_options: CalendarEvent["categories"][number]["options"] | null
    category_created_by: string | null
    category_created_at: string | null
    category_updated_at: string | null
    recurrence: CalendarEvent["recurrence"] | null
    exceptions: CalendarEvent["exceptions"] | null
    participants: CalendarEvent["participants"] | null
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
    const categories =
        event.categories?.map((category) => ({
            ...category,
            calendarId: category.calendarId || event.calendar_id,
            options: {
                visibleByDefault: category.options?.visibleByDefault !== false,
                color: normalizeCalendarCategoryColor(category.options?.color),
            },
        })) ??
        (event.category_id && event.category_name
            ? [
                  {
                      id: event.category_id,
                      calendarId: event.calendar_id,
                      name: event.category_name,
                      options: {
                          visibleByDefault:
                              event.category_options?.visibleByDefault !== false,
                          color: normalizeCalendarCategoryColor(
                              event.category_options?.color
                          ),
                      },
                      createdById: event.category_created_by,
                      createdAt: new Date(
                          event.category_created_at ?? event.created_at
                      ).valueOf(),
                      updatedAt: new Date(
                          event.category_updated_at ??
                              event.category_created_at ??
                              event.created_at
                      ).valueOf(),
                  },
              ]
            : [])
    const primaryCategory = categories[0] ?? null

    return {
        id: event.id,
        title: event.title,
        content: parseEventContent(event.content),
        start,
        end,
        allDay: true,
        timezone: "Asia/Seoul",
        categoryIds: categories.map((category) => category.id),
        categories,
        categoryId: primaryCategory?.id ?? null,
        category: primaryCategory,
        recurrence: event.recurrence ?? undefined,
        exceptions: event.exceptions ?? undefined,
        participants: event.participants ?? [],
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
