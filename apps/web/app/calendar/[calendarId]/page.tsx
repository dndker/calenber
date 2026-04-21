import { CalendarPageContent } from "@/components/calendar/calendar-page-content"
import {
    getServerCalendarById,
    getServerEventMetadataByCalendarId,
} from "@/lib/calendar/server-queries"
import {
    buildCalendarMetadata,
    buildEventMetadata,
    demoCalendarSummary,
} from "@/lib/calendar/share-metadata"
import type { Metadata } from "next"

export async function generateMetadata({
    params,
    searchParams,
}: {
    params: Promise<{ calendarId: string }>
    searchParams: Promise<{ e?: string }>
}): Promise<Metadata> {
    const [{ calendarId }, { e }] = await Promise.all([params, searchParams])

    if (e) {
        const { calendar, event } =
            calendarId === "demo"
                ? {
                      calendar: demoCalendarSummary,
                      event: null,
                  }
                : await getServerEventMetadataByCalendarId(calendarId, e, true)

        return buildEventMetadata({
            calendar,
            calendarId,
            event,
            eventId: e,
            modal: true,
        })
    }

    const calendar =
        calendarId === "demo"
            ? demoCalendarSummary
            : await getServerCalendarById(calendarId)

    return buildCalendarMetadata({
        calendar,
        calendarId,
    })
}

export default async function Page({
    params,
}: {
    params: Promise<{ calendarId: string }>
}) {
    await params

    return <CalendarPageContent />
}
