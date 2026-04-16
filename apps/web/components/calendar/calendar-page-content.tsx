"use client"

import { EventModal } from "@/components/calendar/event-modal"
import { useCalendarWorkspaceRealtime } from "@/hooks/use-calendar-workspace-realtime"
import MonthView from "@/components/calendar/month-view"

export function CalendarPageContent({ eventId }: { eventId?: string }) {
    useCalendarWorkspaceRealtime()

    return (
        <>
            <MonthView />

            <EventModal e={eventId} />
        </>
    )
}
