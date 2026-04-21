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
        const store = useCalendarStore.getState()
        store.setActiveEventId(eventId)
        store.setViewEvent(initialEvent ?? null)

        return () => {
            const currentStore = useCalendarStore.getState()
            const currentActiveEventId = currentStore.activeEventId

            if (currentActiveEventId === eventId) {
                currentStore.setActiveEventId(undefined)
            }

            if (currentStore.viewEvent?.id === eventId) {
                currentStore.setViewEvent(null)
            }
        }
    }, [eventId, initialEvent])

    return (
        <div className="mx-auto w-full max-w-180.75 px-3 py-3 sm:py-25">
            <EventPage eventId={eventId} initialEvent={initialEvent} />
        </div>
    )
}
