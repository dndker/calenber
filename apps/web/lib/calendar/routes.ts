export function getCalendarPath(calendarId: string) {
    return `/calendar/${calendarId}`
}

export function getCalendarEventPath(calendarId: string, eventId: string) {
    return `${getCalendarPath(calendarId)}?e=${encodeURIComponent(eventId)}`
}

export function getCalendarBasePath(pathname: string) {
    if (pathname === "/calendar") {
        return pathname
    }

    if (pathname.startsWith("/calendar/")) {
        const [, , calendarId] = pathname.split("/")

        if (calendarId) {
            return getCalendarPath(calendarId)
        }
    }

    return "/calendar"
}
