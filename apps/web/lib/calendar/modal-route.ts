import {
    getCalendarBasePath,
    resolveCalendarIdFromPathParam,
} from "./routes"
import {
    createShortCalendarEventToken,
    parseShortCalendarEventToken,
} from "./short-link"

export function getCalendarModalEventId(
    searchParams: Pick<URLSearchParams, "get">
) {
    const encodedEventId = searchParams.get("e")?.trim()

    if (!encodedEventId) {
        return undefined
    }

    const parsed = parseShortCalendarEventToken(encodedEventId)

    if (parsed?.eventId) {
        return parsed.eventId
    }

    // 하위 호환: 기존처럼 raw eventId를 바로 담은 URL도 열리도록 유지
    return encodedEventId
}

export function getCalendarModalOccurrenceStart(
    searchParams: Pick<URLSearchParams, "get">
) {
    const rawValue = searchParams.get("o")?.trim()

    if (!rawValue) {
        return undefined
    }

    const parsed = Number(rawValue)

    if (!Number.isFinite(parsed)) {
        return undefined
    }

    return Math.trunc(parsed)
}

export function getCalendarModalClosePath(pathname: string) {
    return getCalendarBasePath(pathname)
}

export function getCalendarModalOpenPath({
    pathname,
    eventId,
    occurrenceStart,
}: {
    pathname: string
    eventId: string
    occurrenceStart?: number
}) {
    const calendarBasePath = getCalendarBasePath(pathname)
    const calendarId = resolveCalendarIdFromPathParam(
        calendarBasePath.split("/")[2] ?? "demo"
    )
    const token = createShortCalendarEventToken({
        calendarId,
        eventId,
        modal: true,
    })
    const basePath = `${calendarBasePath}?e=${encodeURIComponent(token)}`

    if (occurrenceStart === undefined) {
        return basePath
    }

    const divider = basePath.includes("?") ? "&" : "?"

    return `${basePath}${divider}o=${encodeURIComponent(String(occurrenceStart))}`
}
