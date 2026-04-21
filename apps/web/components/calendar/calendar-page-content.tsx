"use client"

import { EventModal } from "@/components/calendar/event-modal"
import MonthView from "@/components/calendar/month-view"

export function CalendarPageContent() {
    // useCalendarWorkspaceRealtime()

    return (
        <>
            <MonthView />

            <EventModal />
        </>
    )
}
