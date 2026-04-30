/**
 * Google Calendar API 이벤트 → CalendarEvent 변환
 *
 * Google 이벤트는 구독 이벤트로 표시되므로:
 * - id: "gcal:<catalogId>:<googleEventId>" 형식
 * - subscription 메타데이터 포함
 * - isLocked: true (읽기 전용 기본값, 쓰기 권한 있을 때 false)
 */

import type { CalendarEvent, EventSubscriptionItem } from "@/store/calendar-store.types"
import type { GoogleCalendarEvent } from "@/lib/google/calendar-api"
import type { CalendarCollectionColor } from "@/lib/calendar/collection-color"
import { normalizeCalendarCollectionColor } from "@/lib/calendar/collection-color"

export const GOOGLE_CALENDAR_PROVIDER_KEY = "google_calendar_v1"
export const GOOGLE_CALENDAR_EVENT_PREFIX = "gcal"

/**
 * Google 이벤트 복합 ID 생성
 * 형식: gcal:<catalogId>:<googleEventId>
 */
export function makeGoogleCalendarEventId(catalogId: string, googleEventId: string): string {
    return `${GOOGLE_CALENDAR_EVENT_PREFIX}:${catalogId}:${googleEventId}`
}

/**
 * Google 이벤트 복합 ID 파싱
 */
export function parseGoogleCalendarEventId(eventId: string): {
    catalogId: string
    googleEventId: string
} | null {
    if (!eventId.startsWith(`${GOOGLE_CALENDAR_EVENT_PREFIX}:`)) return null
    const parts = eventId.split(":")
    // gcal:<catalogId>:<googleEventId> — googleEventId 자체에 콜론이 없음을 가정
    if (parts.length < 3) return null
    return {
        catalogId: parts[1]!,
        googleEventId: parts.slice(2).join(":"),
    }
}

export function isGoogleCalendarEventId(eventId: string): boolean {
    return parseGoogleCalendarEventId(eventId) !== null
}

/** Google 색상 ID → CalendarCollectionColor 매핑 */
const GOOGLE_COLOR_MAP: Record<string, CalendarCollectionColor> = {
    "1": "blue",    // Lavender
    "2": "blue",    // Sage → blue 근사
    "3": "green",   // Grape
    "4": "red",     // Flamingo
    "5": "yellow",  // Banana
    "6": "orange",  // Tangerine
    "7": "green",   // Peacock → green 근사
    "8": "gray",    // Graphite
    "9": "blue",    // Blueberry
    "10": "green",  // Basil → green
    "11": "red",    // Tomato
}

function resolveEventColor(
    colorId: string | undefined,
    defaultColor: CalendarCollectionColor
): CalendarCollectionColor {
    if (colorId && colorId in GOOGLE_COLOR_MAP) {
        return GOOGLE_COLOR_MAP[colorId]!
    }
    return defaultColor
}

type MapOptions = {
    catalogId: string
    catalogName: string
    /** catalog의 collection color */
    collectionColor?: string | null
    /** Google Calendar API accessRole이 writer/owner이면 false */
    isLocked?: boolean
    subscriptionMeta: EventSubscriptionItem
}

/**
 * Google Calendar API 이벤트를 CalendarEvent로 변환
 */
export function mapGoogleEventToCalendarEvent(
    googleEvent: GoogleCalendarEvent,
    options: MapOptions
): CalendarEvent | null {
    // cancelled 이벤트는 표시하지 않음 (증분 동기화 삭제 감지용)
    if (googleEvent.status === "cancelled") return null

    const id = makeGoogleCalendarEventId(options.catalogId, googleEvent.id)
    const collectionId = `collection.subscription.google.${options.catalogId}`
    const color = normalizeCalendarCollectionColor(
        resolveEventColor(googleEvent.colorId, normalizeCalendarCollectionColor(options.collectionColor ?? null) ?? "blue")
    ) ?? "blue"

    // 시작/종료 시간 파싱
    const { start: startMs, end: endMs, allDay } = parseGoogleDateTime(
        googleEvent.start,
        googleEvent.end
    )

    if (startMs === null || endMs === null) return null

    const title = googleEvent.summary?.trim() || "(제목 없음)"

    return {
        id,
        title,
        content: googleEvent.description
            ? [{ type: "paragraph" as const, content: [googleEvent.description] }]
            : [{ type: "paragraph" as const, content: [] }],
        start: startMs,
        end: endMs,
        allDay,
        timezone: googleEvent.start.timeZone ?? "UTC",
        collectionIds: [collectionId],
        collections: [
            {
                id: collectionId,
                calendarId: "subscriptions",
                name: options.catalogName,
                options: {
                    visibleByDefault: true,
                    color,
                },
                createdById: null,
                createdAt: 0,
                updatedAt: 0,
            },
        ],
        primaryCollectionId: collectionId,
        primaryCollection: {
            id: collectionId,
            calendarId: "subscriptions",
            name: options.catalogName,
            options: {
                visibleByDefault: true,
                color,
            },
            createdById: null,
            createdAt: 0,
            updatedAt: 0,
        },
        participants: [],
        isFavorite: false,
        favoritedAt: null,
        status: "scheduled",
        authorId: null,
        author: null,
        updatedById: null,
        updatedBy: null,
        subscription: options.subscriptionMeta,
        isLocked: options.isLocked ?? true,
        createdAt: googleEvent.created ? new Date(googleEvent.created).getTime() : 0,
        updatedAt: googleEvent.updated ? new Date(googleEvent.updated).getTime() : 0,
    }
}

type ParsedDateTime = {
    start: number | null
    end: number | null
    allDay: boolean
}

function parseGoogleDateTime(
    start: GoogleCalendarEvent["start"],
    end: GoogleCalendarEvent["end"]
): ParsedDateTime {
    // 종일 이벤트
    if (start.date) {
        const startMs = new Date(start.date + "T00:00:00").getTime()
        // Google end.date는 exclusive (다음 날) → -1ms
        const endDate = end.date ? new Date(end.date + "T00:00:00").getTime() - 1 : startMs
        return { start: startMs, end: endDate, allDay: true }
    }

    // 시간 지정 이벤트
    if (start.dateTime) {
        const startMs = new Date(start.dateTime).getTime()
        const endMs = end.dateTime ? new Date(end.dateTime).getTime() : startMs + 3600_000
        return { start: startMs, end: endMs, allDay: false }
    }

    return { start: null, end: null, allDay: false }
}
