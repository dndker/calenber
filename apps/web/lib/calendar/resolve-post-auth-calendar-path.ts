"use client"

import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { getCalendarPath } from "./routes"

function sleep(ms: number) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms)
    })
}

async function getLatestCalendarPath(userId: string) {
    const supabase = createBrowserSupabase()

    const { data: memberships, error: membershipError } = await supabase
        .from("calendar_members")
        .select("calendar_id")
        .eq("user_id", userId)

    if (membershipError || !memberships?.length) {
        return null
    }

    const calendarIds = memberships.flatMap((membership: { calendar_id: string | null }) =>
        membership.calendar_id ? [membership.calendar_id] : []
    )

    if (!calendarIds.length) {
        return null
    }

    const { data: calendars, error: calendarError } = await supabase
        .from("calendars")
        .select("id, updated_at, created_at")
        .in("id", calendarIds)
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)

    if (calendarError || !calendars?.length) {
        return null
    }

    return getCalendarPath(calendars[0]!.id)
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
