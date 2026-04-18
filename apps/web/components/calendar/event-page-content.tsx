"use client"

import { useCalendarStore } from "@/store/useCalendarStore"
import { useEffect } from "react"
import { EventPage } from "./event-page"

export function EventPageContent({ eventId }: { eventId?: string }) {
    // useCalendarWorkspaceRealtime()

    useEffect(() => {
        useCalendarStore.setState({ activeEventId: eventId })
    }, [eventId])

    return (
        <div className="mx-auto w-full max-w-180.75 px-3 py-3 sm:py-25">
            <EventPage eventId={eventId} />
        </div>
    )
}
