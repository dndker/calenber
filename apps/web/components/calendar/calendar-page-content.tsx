"use client"

import { EventModal } from "@/components/calendar/event-modal"
import type { CalendarEvent } from "@/store/calendar-store.types"
import MonthView from "@/components/calendar/month-view"

export function CalendarPageContent({
    eventId,
    initialEvent,
}: {
    eventId?: string
    initialEvent?: CalendarEvent | null
}) {
    // useCalendarWorkspaceRealtime()

    return (
        <>
            <MonthView />

            <EventModal e={eventId} initialEvent={initialEvent} />
        </>
    )
}
