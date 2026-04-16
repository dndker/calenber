export function getCalendarPath(calendarId: string) {
    return `/calendar/${calendarId}`
}

export function getCalendarEventModalPath(calendarId: string, eventId: string) {
    return `${getCalendarPath(calendarId)}?e=${encodeURIComponent(eventId)}`
}

export function getCalendarEventPagePath(calendarId: string, eventId: string) {
    return `${getCalendarPath(calendarId)}/${encodeURIComponent(eventId)}`
}

export function getCalendarBasePath(pathname: string) {
    if (pathname.startsWith("/calendar/")) {
        const [, , calendarId] = pathname.split("/")

        if (calendarId) {
            return getCalendarPath(calendarId)
        }
    }

    return getCalendarPath("demo")
}
