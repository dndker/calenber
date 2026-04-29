import { normalizeCalendarCollectionColor } from "@/lib/calendar/collection-color"
import type {
    CalendarEvent,
    CalendarEventCollection,
    EventSubscriptionItem,
} from "@/store/calendar-store.types"

export type SharedCollectionRpcRow = {
    event_id: string
    title: string
    content: unknown
    start_at: string | null
    end_at: string | null
    all_day: boolean
    timezone: string
    event_status: string
    recurrence: CalendarEvent["recurrence"] | null
    exceptions: string[] | null
    collection_id: string | null
    collection_name: string | null
    collection_color: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function normalizePostgrestRecordKeys(
    row: Record<string, unknown>
): Record<string, unknown> {
    const plain: Record<string, unknown> = {}
    const fromPrefixed: Array<[string, unknown]> = []

    for (const [key, value] of Object.entries(row)) {
        if (key.startsWith("out_") && key.length > 4) {
            fromPrefixed.push([key.slice(4), value])
        } else {
            plain[key] = value
        }
    }

    for (const [key, value] of fromPrefixed) {
        if (!(key in plain)) {
            plain[key] = value
        }
    }

    return plain
}

function pickStr(v: unknown): string {
    if (v === null || v === undefined) return ""
    return typeof v === "string" ? v : String(v)
}

function pickStrNull(v: unknown): string | null {
    if (v === null || v === undefined) return null
    return typeof v === "string" ? v : String(v)
}

function pickBool(v: unknown, fallback = false): boolean {
    return typeof v === "boolean" ? v : fallback
}

function parseExceptionsFromRpc(value: unknown): string[] | null {
    if (value === null || value === undefined) return null
    if (Array.isArray(value) && value.every((x) => typeof x === "string")) {
        return value as string[]
    }
    return null
}

export function parseSharedCollectionRpcRow(raw: unknown): SharedCollectionRpcRow {
    const m = normalizePostgrestRecordKeys(isRecord(raw) ? raw : {})
    const rawRecurrence = m.recurrence as CalendarEvent["recurrence"] | null | undefined

    const eventStatus =
        pickStr(m.event_status) ||
        pickStr(m.status) ||
        "scheduled"

    const exceptionsParsed = parseExceptionsFromRpc(m.exceptions)

    return {
        event_id: pickStr(m.event_id),
        title: pickStr(m.title),
        content: m.content,
        start_at: pickStrNull(m.start_at),
        end_at: pickStrNull(m.end_at),
        all_day: pickBool(m.all_day),
        timezone: pickStr(m.timezone) || "Asia/Seoul",
        event_status: eventStatus,
        recurrence: rawRecurrence ?? null,
        exceptions: exceptionsParsed,
        collection_id: pickStrNull(m.collection_id),
        collection_name: pickStrNull(m.collection_name),
        collection_color: pickStrNull(m.collection_color),
    }
}

export function calendarEventFromSharedCollectionRow(
    row: SharedCollectionRpcRow,
    compositeEventId: string,
    subscriptionMeta: EventSubscriptionItem
): CalendarEvent {
    const start = row.start_at ? new Date(row.start_at).valueOf() : Date.now()
    const end = row.end_at ? new Date(row.end_at).valueOf() : start

    const collection: CalendarEventCollection | null = row.collection_id
        ? {
              id: row.collection_id,
              calendarId: "",
              name: row.collection_name ?? "",
              options: {
                  visibleByDefault: true,
                  color: normalizeCalendarCollectionColor(row.collection_color),
              },
              createdById: null,
              createdAt: 0,
              updatedAt: 0,
          }
        : null

    return {
        id: compositeEventId,
        title: row.title,
        content: Array.isArray(row.content)
            ? (row.content as CalendarEvent["content"])
            : [{ type: "paragraph", content: [] }],
        start,
        end,
        allDay: row.all_day,
        timezone: row.timezone || "Asia/Seoul",
        collectionIds: collection ? [collection.id] : [],
        collections: collection ? [collection] : [],
        primaryCollectionId: collection?.id ?? null,
        primaryCollection: collection,
        recurrence: row.recurrence ?? undefined,
        exceptions: row.exceptions ?? [],
        participants: [],
        isFavorite: false,
        favoritedAt: null,
        status: row.event_status as CalendarEvent["status"],
        authorId: null,
        author: null,
        updatedById: null,
        updatedBy: null,
        isLocked: true,
        createdAt: 0,
        updatedAt: 0,
        subscription: subscriptionMeta,
    }
}
