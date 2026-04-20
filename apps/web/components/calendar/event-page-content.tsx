"use client"

import type { CalendarEvent } from "@/store/calendar-store.types"
import { useCalendarStore } from "@/store/useCalendarStore"
import { useEffect } from "react"
import { EventPage } from "./event-page"

export function EventPageContent({
    eventId,
    initialEvent,
}: {
    eventId?: string
    initialEvent?: CalendarEvent | null
}) {
    // useCalendarWorkspaceRealtime()

    useEffect(() => {
        useCalendarStore.setState({ activeEventId: eventId })

        if (initialEvent) {
            useCalendarStore.getState().upsertEventSnapshot(initialEvent)
        }

        return () => {
            const currentActiveEventId =
                useCalendarStore.getState().activeEventId

            if (currentActiveEventId === eventId) {
                useCalendarStore.setState({ activeEventId: undefined })
            }
        }
    }, [eventId, initialEvent])

    return (
        <div className="mx-auto w-full max-w-180.75 px-3 py-3 sm:py-25">
            <EventPage eventId={eventId} initialEvent={initialEvent} />
        </div>
    )
}
