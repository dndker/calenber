import { parseEventContent } from "@/lib/calendar/event-content"
import { normalizeCalendarCollectionColor } from "@/lib/calendar/collection-color"
import type { CalendarEvent } from "@/store/calendar-store.types"

export type CalendarEventRecord = {
    id: string
    calendar_id: string
    title: string
    content: CalendarEvent["content"] | string | null
    start_at: string | null
    end_at: string | null
    all_day: boolean | null
    timezone: string | null
    collections: CalendarEvent["collections"] | null
    primary_collection_id: string | null
    primary_collection_name: string | null
    primary_collection_created_by: string | null
    primary_collection_created_at: string | null
    primary_collection_updated_at: string | null
    recurrence: CalendarEvent["recurrence"] | null
    exceptions: CalendarEvent["exceptions"] | null
    participants: CalendarEvent["participants"] | null
    is_favorite: boolean | null
    favorited_at: string | null
    status: CalendarEvent["status"] | null
    created_by: string | null
    updated_by: string | null
    is_locked: boolean | null
    /** 구글 캘린더에도 저장한 경우의 구글 이벤트 ID (중복 표시 방지용) */
    google_event_id: string | null
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
    const collections =
        event.collections?.map((collection) => ({
            ...collection,
            calendarId: collection.calendarId || event.calendar_id,
            options: {
                visibleByDefault: collection.options?.visibleByDefault !== false,
                color: normalizeCalendarCollectionColor(collection.options?.color),
            },
        })) ??
        (event.primary_collection_id && event.primary_collection_name
            ? [
                  {
                      id: event.primary_collection_id,
                      calendarId: event.calendar_id,
                      name: event.primary_collection_name,
                      options: {
                          visibleByDefault: true,
                          color: undefined,
                      },
                      createdById: event.primary_collection_created_by,
                      createdAt: new Date(
                          event.primary_collection_created_at ?? event.created_at
                      ).valueOf(),
                      updatedAt: new Date(
                          event.primary_collection_updated_at ??
                              event.primary_collection_created_at ??
                              event.created_at
                      ).valueOf(),
                  },
              ]
            : [])
    const primaryCollection = collections[0] ?? null

    return {
        id: event.id,
        title: event.title,
        content: parseEventContent(event.content),
        start,
        end,
        allDay: event.all_day ?? false,
        timezone: event.timezone?.trim() || "Asia/Seoul",
        collectionIds: collections.map((collection) => collection.id),
        collections,
        primaryCollectionId: primaryCollection?.id ?? null,
        primaryCollection,
        recurrence: event.recurrence ?? undefined,
        exceptions: event.exceptions ?? undefined,
        participants: event.participants ?? [],
        isFavorite: event.is_favorite === true,
        favoritedAt: event.favorited_at
            ? new Date(event.favorited_at).valueOf()
            : null,
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
        googleEventId: event.google_event_id ?? undefined,
        createdAt: new Date(event.created_at).valueOf(),
        updatedAt: new Date(event.updated_at ?? event.created_at).valueOf(),
    }
}
