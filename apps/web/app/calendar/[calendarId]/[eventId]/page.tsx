import { EventPageContent } from "@/components/calendar/event-page-content"
import {
    getServerEventPageDataByCalendarId,
} from "@/lib/calendar/server-queries"
import {
    buildEventMetadata,
    demoCalendarSummary,
} from "@/lib/calendar/share-metadata"
import type { Metadata } from "next"

export async function generateMetadata({
    params,
}: {
    params: Promise<{ calendarId: string; eventId: string }>
}): Promise<Metadata> {
    const { calendarId, eventId } = await params
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
    const { calendarId, eventId } = await params
    const { event } =
        calendarId === "demo"
            ? {
                  event: null,
              }
            : await getServerEventPageDataByCalendarId(calendarId, eventId, true)

    return <EventPageContent eventId={eventId} initialEvent={event} />
}
