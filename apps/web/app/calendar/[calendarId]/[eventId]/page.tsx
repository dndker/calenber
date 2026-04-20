import { EventPageContent } from "@/components/calendar/event-page-content"
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
}: {
    params: Promise<{ calendarId: string; eventId: string }>
}): Promise<Metadata> {
    const { calendarId, eventId } = await params
    const supabase = await createServerSupabase()
    const [calendar, event] = await Promise.all([
        calendarId === "demo"
            ? Promise.resolve(demoCalendarSummary)
            : getCalendarById(supabase, calendarId),
        getEventById(supabase, eventId, { silentMissing: true }),
    ])

    return buildEventMetadata({
        calendar,
        calendarId,
        event,
        eventId,
    })
}

export default async function Page({
    params,
}: {
    params: Promise<{ calendarId: string; eventId: string }>
}) {
    const { eventId } = await params
    const supabase = await createServerSupabase()
    const initialEvent = await getEventById(supabase, eventId, {
        silentMissing: true,
    })

    return (
        <EventPageContent eventId={eventId} initialEvent={initialEvent} />
    )
}
