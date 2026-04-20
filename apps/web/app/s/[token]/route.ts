import { getEventById } from "@/lib/calendar/queries"
import {
    getResolvedShortCalendarEventPath,
    parseShortCalendarEventToken,
} from "@/lib/calendar/short-link"
import { createServerSupabase } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(
    request: Request,
    context: { params: Promise<{ token: string }> }
) {
    const { token } = await context.params
    const parsed = parseShortCalendarEventToken(token)

    if (!parsed) {
        return new NextResponse(null, { status: 404 })
    }

    if (parsed.calendarId) {
        const path = getResolvedShortCalendarEventPath({
            calendarId: parsed.calendarId,
            eventId: parsed.eventId,
            modal: parsed.modal,
        })
        return NextResponse.redirect(new URL(path, request.url))
    }

    const supabase = await createServerSupabase()
    const event = await getEventById(supabase, parsed.eventId, {
        silentMissing: true,
    })

    if (!event) {
        return new NextResponse(null, { status: 404 })
    }

    const eventRecord = await supabase
        .from("events")
        .select("calendar_id")
        .eq("id", parsed.eventId)
        .maybeSingle()

    const calendarId = eventRecord.data?.calendar_id

    if (!calendarId) {
        return new NextResponse(null, { status: 404 })
    }

    const path = getResolvedShortCalendarEventPath({
        calendarId,
        eventId: parsed.eventId,
        modal: parsed.modal,
    })

    return NextResponse.redirect(new URL(path, request.url))
}
