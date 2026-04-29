import { CalendarPageContent } from "@/components/calendar/calendar-page-content"
import {
    getServerCalendarInitialData,
    getServerEventMetadataByCalendarId,
} from "@/lib/calendar/server-queries"
import {
    buildCalendarMetadata,
    buildEventMetadata,
    demoCalendarSummary,
} from "@/lib/calendar/share-metadata"
import {
    resolveCalendarIdFromPathParam,
} from "@/lib/calendar/routes"
import { parseShortCalendarEventToken } from "@/lib/calendar/short-link"
import type { Metadata } from "next"

export async function generateMetadata({
    params,
    searchParams,
}: {
    params: Promise<{ calendarId: string }>
    searchParams: Promise<{ e?: string }>
}): Promise<Metadata> {
    const [{ calendarId: rawCalendarId }, { e }] = await Promise.all([
        params,
        searchParams,
    ])
    const calendarId = resolveCalendarIdFromPathParam(rawCalendarId)
    const resolvedEventId =
        e ? (parseShortCalendarEventToken(e)?.eventId ?? e) : undefined

    if (resolvedEventId) {
        const { calendar, event } =
            calendarId === "demo"
                ? {
                      calendar: demoCalendarSummary,
                      event: null,
                  }
                : await getServerEventMetadataByCalendarId(
                      calendarId,
                      resolvedEventId,
                      true
                  )

        return buildEventMetadata({
            calendar,
            calendarId,
            event,
            eventId: resolvedEventId,
            modal: true,
        })
    }

    const calendar =
        calendarId === "demo"
            ? demoCalendarSummary
            : (await getServerCalendarInitialData(calendarId)).calendar

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
