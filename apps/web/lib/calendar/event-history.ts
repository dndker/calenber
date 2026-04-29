import type { CalendarRole } from "@/lib/calendar/permissions"
import { isCalendarEventUuid } from "@/lib/calendar/event-id"
import { createBrowserSupabase } from "@/lib/supabase/client"
import type { PostgrestError } from "@supabase/supabase-js"

export type CalendarEventHistoryItem = {
    id: string
    calendarId: string
    eventId: string
    action: "created" | "updated" | "deleted"
    actorUserId: string | null
    actorRole: CalendarRole | null
    summary: string
    changes: Array<{
        field: string
        label: string
        op: "added" | "removed" | "changed"
        before?: unknown
        after?: unknown
    }>
    occurredAt: number
    actorName: string | null
    actorEmail: string | null
    actorAvatarUrl: string | null
}

type CalendarEventHistoryRow = {
    id: string
    calendar_id: string
    event_id: string
    action: CalendarEventHistoryItem["action"]
    actor_user_id: string | null
    actor_role: CalendarRole | null
    summary: string
    changes: CalendarEventHistoryItem["changes"] | null
    occurred_at: string
    actor_name: string | null
    actor_email: string | null
    actor_avatar_url: string | null
}

type EventHistoryCacheEntry = {
    data: CalendarEventHistoryItem[]
    promise: Promise<CalendarEventHistoryItem[]> | null
    fetchedAt: number
}

const EVENT_HISTORY_CACHE_TTL_MS = 30_000
const eventHistoryCache = new Map<string, EventHistoryCacheEntry>()

function mapCalendarEventHistoryRow(
    row: CalendarEventHistoryRow
): CalendarEventHistoryItem {
    return {
        id: row.id,
        calendarId: row.calendar_id,
        eventId: row.event_id,
        action: row.action,
        actorUserId: row.actor_user_id,
        actorRole: row.actor_role,
        summary: row.summary,
        changes: Array.isArray(row.changes) ? row.changes : [],
        occurredAt: new Date(row.occurred_at).valueOf(),
        actorName: row.actor_name,
        actorEmail: row.actor_email,
        actorAvatarUrl: row.actor_avatar_url,
    }
}

function getFreshCache(eventId: string) {
    const cached = eventHistoryCache.get(eventId)

    if (!cached) {
        return null
    }

    if (Date.now() - cached.fetchedAt > EVENT_HISTORY_CACHE_TTL_MS) {
        return null
    }

    return cached
}

export function getCachedCalendarEventHistory(eventId: string) {
    return getFreshCache(eventId)?.data ?? null
}

export async function loadCalendarEventHistory(
    eventId: string,
    options?: {
        force?: boolean
        limit?: number
    }
) {
    if (!isCalendarEventUuid(eventId)) {
        return []
    }

    const limit = options?.limit ?? 50
    const freshCache = !options?.force ? getFreshCache(eventId) : null

    if (freshCache?.data) {
        return freshCache.data
    }

    if (freshCache?.promise) {
        return freshCache.promise
    }

    const supabase = createBrowserSupabase()
    const promise = supabase
        .rpc("get_calendar_event_history", {
            target_event_id: eventId,
            history_limit: limit,
            history_offset: 0,
        })
        .then(
            ({
                data,
                error,
            }: {
                data: CalendarEventHistoryRow[] | null
                error: PostgrestError | null
            }) => {
            if (error) {
                throw error
            }

            const nextData = ((data as CalendarEventHistoryRow[] | null) ?? []).map(
                mapCalendarEventHistoryRow
            )

            eventHistoryCache.set(eventId, {
                data: nextData,
                fetchedAt: Date.now(),
                promise: null,
            })

            return nextData
            }
        )
        .catch((error: unknown) => {
            eventHistoryCache.delete(eventId)
            throw error
        })

    eventHistoryCache.set(eventId, {
        data: freshCache?.data ?? [],
        fetchedAt: freshCache?.fetchedAt ?? 0,
        promise,
    })

    return promise
}

export function warmCalendarEventHistory(eventId: string, limit?: number) {
    void loadCalendarEventHistory(eventId, { limit }).catch(() => {})
}
