import { EventPageContent } from "@/components/calendar/event-page-content"
import {
    getServerEventPageDataByCalendarId,
} from "@/lib/calendar/server-queries"
import {
    buildEventMetadata,
    demoCalendarSummary,
} from "@/lib/calendar/share-metadata"
import { resolveCalendarIdFromPathParam } from "@/lib/calendar/routes"
import type { Metadata } from "next"

export async function generateMetadata({
    params,
}: {
    params: Promise<{ calendarId: string; eventId: string }>
}): Promise<Metadata> {
    const { calendarId: rawCalendarId, eventId } = await params
    const calendarId = resolveCalendarIdFromPathParam(rawCalendarId)
    const { calendar, event } =
        calendarId === "demo"
            ? {
                  calendar: demoCalendarSummary,
                  event: null,
              }
            : await getServerEventPageDataByCalendarId(calendarId, eventId, true)

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
    const { calendarId: rawCalendarId, eventId } = await params
    const calendarId = resolveCalendarIdFromPathParam(rawCalendarId)
    const { event } =
        calendarId === "demo"
            ? {
                  event: null,
              }
            : await getServerEventPageDataByCalendarId(calendarId, eventId, true)

    return <EventPageContent eventId={eventId} initialEvent={event} />
}
