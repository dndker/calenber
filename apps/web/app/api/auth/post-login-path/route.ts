import { getServerUser } from "@/lib/auth/get-server-user"
import { resolveServerCalendarPath } from "@/lib/calendar/resolve-server-calendar-path"
import { createServerSupabase } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
    const [cookieStore, user, supabase] = await Promise.all([
        cookies(),
        getServerUser(),
        createServerSupabase(),
    ])
    const path = await resolveServerCalendarPath({
        supabase,
        userId: user?.id,
        cookieStore,
        fallbackPath: user ? "/calendar" : "/calendar/demo",
    })

    return NextResponse.json(
        {
            path,
        },
        {
            headers: {
                "cache-control": "no-store",
            },
        }
    )
}
