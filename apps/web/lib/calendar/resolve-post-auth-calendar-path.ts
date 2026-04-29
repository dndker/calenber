"use client"

import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import {
    getRecentCalendarPathFromCookieValue,
    RECENT_CALENDAR_COOKIE_NAME,
} from "./recent-calendar-cookie"
import { getLatestCalendarIdForUser } from "./queries"
import { getCalendarPath } from "./routes"

function sleep(ms: number) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms)
    })
}

async function getLatestCalendarPath(userId: string) {
    const supabase = createBrowserSupabase()
    const calendarId = await getLatestCalendarIdForUser(supabase, userId)

    return calendarId ? getCalendarPath(calendarId) : null
}

async function getPostLoginPathFromServer() {
    try {
        const response = await fetch("/api/auth/post-login-path", {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
        })

        if (!response.ok) {
            return null
        }

        const data = (await response.json()) as { path?: unknown }

        return typeof data.path === "string" ? data.path : null
    } catch {
        return null
    }
}

function getRecentCalendarPathFromCookie() {
    const cookieValue = document.cookie
        .split("; ")
        .find((cookie) => cookie.startsWith(`${RECENT_CALENDAR_COOKIE_NAME}=`))
        ?.split("=")[1]

    return getRecentCalendarPathFromCookieValue(
        cookieValue ? decodeURIComponent(cookieValue) : null
    )
}

export async function resolvePostAuthCalendarPath(
    initialUserId?: string | null
) {
    const recentCalendarPath = getRecentCalendarPathFromCookie()

    if (recentCalendarPath) {
        return recentCalendarPath
    }

    let userId = initialUserId ?? null

    if (!userId) {
        const supabase = createBrowserSupabase()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        userId = user?.id ?? null
    }

    if (!userId) {
        return "/calendar/demo"
    }

    const serverResolvedPath = await getPostLoginPathFromServer()

    if (serverResolvedPath) {
        return serverResolvedPath
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
        const path = await getLatestCalendarPath(userId)

        if (path) {
            return path
        }

        await sleep(80 * (attempt + 1))
    }

    return "/calendar"
}
