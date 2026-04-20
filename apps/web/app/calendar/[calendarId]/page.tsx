import { CalendarPageContent } from "@/components/calendar/calendar-page-content"
import {
    getCalendarById,
    getEventById,
} from "@/lib/calendar/queries"
import {
    buildEventMetadata,
    demoCalendarSummary,
} from "@/lib/calendar/share-metadata"
import { createServerSupabase } from "@/lib/supabase/server"
import type { Metadata } from "next"

export async function generateMetadata({
    params,
    searchParams,
}: {
    params: Promise<{ calendarId: string }>
    searchParams: Promise<{ e?: string }>
}): Promise<Metadata> {
    const [{ calendarId }, { e }] = await Promise.all([params, searchParams])

    if (!e) {
        return {}
    }

    const supabase = await createServerSupabase()
    const [calendar, event] = await Promise.all([
        calendarId === "demo"
            ? Promise.resolve(demoCalendarSummary)
            : getCalendarById(supabase, calendarId),
        getEventById(supabase, e, { silentMissing: true }),
    ])

    return buildEventMetadata({
        calendar,
        calendarId,
        event,
        eventId: e,
        modal: true,
    })
}

export default async function Page({
    params,
    searchParams,
}: {
    params: Promise<{ calendarId: string }>
    searchParams: Promise<{ e?: string }>
}) {
    const [, { e }] = await Promise.all([params, searchParams])
    let initialEvent = null

    if (e) {
        const supabase = await createServerSupabase()
        initialEvent = await getEventById(supabase, e, {
            silentMissing: true,
        })
    }

    return <CalendarPageContent eventId={e} initialEvent={initialEvent} />
}
