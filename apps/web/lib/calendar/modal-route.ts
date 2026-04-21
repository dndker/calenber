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

export function getCalendarModalClosePath(pathname: string) {
    return getCalendarBasePath(pathname)
}

export function getCalendarModalOpenPath({
    pathname,
    eventId,
}: {
    pathname: string
    eventId: string
}) {
    const calendarBasePath = getCalendarBasePath(pathname)
    const calendarId = calendarBasePath.split("/")[2] ?? "demo"

    return getCalendarEventModalPath(calendarId, eventId)
}
