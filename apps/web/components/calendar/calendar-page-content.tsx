"use client"

import { EventModal } from "@/components/calendar/event-modal"
import MonthView from "@/components/calendar/month-view"

export function CalendarPageContent({ eventId }: { eventId?: string }) {
    // useCalendarWorkspaceRealtime()

    return (
        <>
            <MonthView />

            <EventModal e={eventId} />
        </>
    )
}
