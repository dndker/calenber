import { getServerUser } from "@/lib/auth/get-server-user"
import { getEventById } from "@/lib/calendar/queries"
import { createServerSupabase } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
    const user = await getServerUser()

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const calendarId = searchParams.get("calendarId")
    const eventId = searchParams.get("eventId")

    if (!calendarId || !eventId) {
        return NextResponse.json(
            { error: "Missing required params" },
            { status: 400 }
        )
    }

    const supabase = await createServerSupabase()
    const event = await getEventById(supabase, eventId, {
        silentMissing: true,
        viewerCalendarId: calendarId,
        viewerUserId: user.id,
    })

    if (!event) {
        return NextResponse.json({ event: null }, { status: 404 })
    }

    return NextResponse.json({ event })
}
