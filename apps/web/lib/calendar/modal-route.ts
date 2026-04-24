import {
    getCalendarBasePath,
    getCalendarEventModalPath,
} from "./routes"

export function getCalendarModalEventId(
    searchParams: Pick<URLSearchParams, "get">
) {
    const eventId = searchParams.get("e")?.trim()

    return eventId ? eventId : undefined
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
    const calendarId = calendarBasePath.split("/")[2] ?? "demo"
    const basePath = getCalendarEventModalPath(calendarId, eventId)

    if (occurrenceStart === undefined) {
        return basePath
    }

    const divider = basePath.includes("?") ? "&" : "?"

    return `${basePath}${divider}o=${encodeURIComponent(String(occurrenceStart))}`
}
