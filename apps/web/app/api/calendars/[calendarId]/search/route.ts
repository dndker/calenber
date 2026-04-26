import { getServerUser } from "@/lib/auth/get-server-user"
import {
    getCalendarById,
    getCalendarEvents,
    getCalendarMemberDirectory,
    getCalendarMembership,
} from "@/lib/calendar/queries"
import {
    getCalendarSearchAvailableFilters,
    listCalendarMembers,
    listRecentCalendarEvents,
    searchCalendarEvents,
    searchCalendarMembers,
    type CalendarSearchFilters,
} from "@/lib/calendar/search"
import { resolveCalendarIdFromPathParam } from "@/lib/calendar/routes"
import { createServerSupabase } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

type SearchRequestPayload = {
    q?: string
    filters?: CalendarSearchFilters
    eventLimit?: number
    memberLimit?: number
}

function clampLimit(value: unknown, fallback: number, max: number) {
    const parsed =
        typeof value === "number" ? value : Number.parseInt(String(value), 10)

    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback
    }

    return Math.min(Math.floor(parsed), max)
}

export async function POST(
    request: Request,
    context: {
        params: Promise<{ calendarId: string }>
    }
) {
    const { calendarId: rawCalendarId } = await context.params
    const calendarId = resolveCalendarIdFromPathParam(rawCalendarId)
    const payload = ((await request.json().catch(() => ({}))) ??
        {}) as SearchRequestPayload
    const query = payload.q?.trim() ?? ""
    const filters = payload.filters ?? {}
    const eventLimit = clampLimit(payload.eventLimit, 20, 50)
    const memberLimit = clampLimit(payload.memberLimit, 20, 200)

    const supabase = await createServerSupabase()
    const user = await getServerUser()
    const calendar = await getCalendarById(supabase, calendarId)

    if (!calendar) {
        return NextResponse.json(
            { error: "Calendar not found." },
            { status: 404 }
        )
    }

    const membership = await getCalendarMembership(
        supabase,
        calendarId,
        user?.id ?? null
    )

    if (!membership.isMember) {
        return NextResponse.json(
            { error: "Only calendar members can search." },
            { status: 403 }
        )
    }

    const [events, members] = await Promise.all([
        getCalendarEvents(supabase, calendarId),
        getCalendarMemberDirectory(supabase, calendarId),
    ])

    return NextResponse.json({
        query,
        filters,
        events: query
            ? searchCalendarEvents({
                  events,
                  query,
                  filters,
                  limit: eventLimit,
              })
            : listRecentCalendarEvents(events, filters, eventLimit),
        members: query
            ? searchCalendarMembers({
                  members,
                  query,
                  limit: memberLimit,
              })
            : listCalendarMembers(members, memberLimit),
        availableFilters: getCalendarSearchAvailableFilters(events),
    })
}
