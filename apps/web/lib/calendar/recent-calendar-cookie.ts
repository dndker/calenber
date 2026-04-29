import {
    getCalendarPath,
    resolveCalendarIdFromPathParam,
} from "@/lib/calendar/routes"

export const RECENT_CALENDAR_COOKIE_NAME = "recent-calendar-id"
export const RECENT_CALENDAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

export function parseRecentCalendarIdCookie(
    value: string | undefined | null
): string | null {
    if (!value) {
        return null
    }

    const trimmed = value.trim()

    if (!trimmed || trimmed === "demo") {
        return null
    }

    return trimmed
}

export function buildRecentCalendarCookieValue(calendarId: string) {
    return `${RECENT_CALENDAR_COOKIE_NAME}=${encodeURIComponent(calendarId)}; path=/; max-age=${RECENT_CALENDAR_COOKIE_MAX_AGE}; samesite=lax`
}

export function buildRecentCalendarCookieClearValue() {
    return `${RECENT_CALENDAR_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`
}

export function getRecentCalendarIdFromPathname(pathname: string) {
    if (!pathname.startsWith("/calendar/")) {
        return null
    }

    const [, , rawCalendarId] = pathname.split("/")

    if (!rawCalendarId) {
        return null
    }

    const calendarId = resolveCalendarIdFromPathParam(rawCalendarId)

    return calendarId === "demo" ? null : calendarId
}

export function getRecentCalendarPathFromCookieValue(
    value: string | undefined | null
) {
    const calendarId = parseRecentCalendarIdCookie(value)

    return calendarId ? getCalendarPath(calendarId) : null
}
