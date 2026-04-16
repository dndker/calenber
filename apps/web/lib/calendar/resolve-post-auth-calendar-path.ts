"use client"

import { createBrowserSupabase } from "@workspace/lib/supabase/client"
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

export async function resolvePostAuthCalendarPath() {
    const supabase = createBrowserSupabase()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return "/calendar"
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const path = await getLatestCalendarPath(user.id)

        if (path) {
            return path
        }

        await sleep(150 * (attempt + 1))
    }

    return "/calendar"
}
