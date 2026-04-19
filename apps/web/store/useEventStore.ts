"use client"

import type { CalendarEvent } from "./calendar-store.types"
import { createSSRStore } from "./createSSRStore"

type EventStore = {
    event: CalendarEvent | null
    eventId: string | null
    setEvent: (event: CalendarEvent | null) => void
}

export const useEventStore = createSSRStore<EventStore>((set) => ({
    event: null,
    eventId: null,

    setEvent: (event) => {
        set({ event, eventId: event?.id })
    },
}))

export const EventStoreProvider = useEventStore.StoreProvider
