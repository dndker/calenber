import { getLatestCalendarIdForUser } from "@/lib/calendar/queries"
import {
    getRecentCalendarPathFromCookieValue,
    RECENT_CALENDAR_COOKIE_NAME,
} from "@/lib/calendar/recent-calendar-cookie"
import { getCalendarPath } from "@/lib/calendar/routes"
import type { SupabaseClient } from "@supabase/supabase-js"

export async function resolveServerCalendarPath(options: {
    supabase: SupabaseClient
    userId: string | null | undefined
    cookieStore?: {
        get(name: string): { value: string } | undefined
    }
    fallbackPath?: string
}) {
    const recentCalendarPath = options.cookieStore
        ? getRecentCalendarPathFromCookieValue(
              options.cookieStore.get(RECENT_CALENDAR_COOKIE_NAME)?.value
          )
        : null

    if (recentCalendarPath) {
        return recentCalendarPath
    }

    if (!options.userId) {
        return options.fallbackPath ?? "/calendar/demo"
    }

    const calendarId = await getLatestCalendarIdForUser(
        options.supabase,
        options.userId
    )

    if (calendarId) {
        return getCalendarPath(calendarId)
    }

    return options.fallbackPath ?? "/calendar"
}
