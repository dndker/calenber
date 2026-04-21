"use client"

import { getEventById } from "@/lib/calendar/queries"
import { createBrowserSupabase } from "@/lib/supabase/client"
import type { CalendarEvent } from "@/store/calendar-store.types"
import { useCalendarStore } from "@/store/useCalendarStore"
import { useEffect, useMemo, useState } from "react"

type UseCalendarEventDetailOptions = {
    eventId?: string
    initialEvent?: CalendarEvent | null
}

export function useCalendarEventDetail({
    eventId,
    initialEvent = null,
}: UseCalendarEventDetailOptions) {
    const storeEvent = useCalendarStore((state) =>
        eventId ? state.events.find((event) => event.id === eventId) : undefined
    )
    const viewEvent = useCalendarStore((state) =>
        eventId && state.viewEvent?.id === eventId ? state.viewEvent : null
    )
    const [remoteState, setRemoteState] = useState<{
        eventId?: string
        event: CalendarEvent | null
        status: "idle" | "loading" | "loaded" | "missing"
    }>({
        eventId: initialEvent?.id,
        event: initialEvent,
        status: initialEvent ? "loaded" : "idle",
    })

    const resolvedInitialEvent =
        initialEvent && initialEvent.id === eventId ? initialEvent : null
    const resolvedViewEvent = viewEvent && viewEvent.id === eventId ? viewEvent : null
    const resolvedRemoteEvent =
        remoteState.eventId === eventId ? remoteState.event : null
    const shouldFetch = Boolean(
        eventId && !storeEvent && !resolvedViewEvent && !resolvedInitialEvent
    )

    const event = useMemo(
        () =>
            storeEvent ??
            resolvedViewEvent ??
            resolvedInitialEvent ??
            resolvedRemoteEvent ??
            null,
        [resolvedInitialEvent, resolvedRemoteEvent, resolvedViewEvent, storeEvent]
    )

    useEffect(() => {
        let cancelled = false

        if (!eventId || !shouldFetch) {
            return () => {
                cancelled = true
            }
        }

        queueMicrotask(() => {
            if (cancelled) {
                return
            }

            setRemoteState((prev) => {
                if (prev.eventId === eventId && prev.status === "loading") {
                    return prev
                }

                return {
                    eventId,
                    event: null,
                    status: "loading",
                }
            })
        })

        const supabase = createBrowserSupabase()

        void getEventById(supabase, eventId, {
            silentMissing: true,
        }).then((nextEvent) => {
            if (cancelled) {
                return
            }

            if (!nextEvent) {
                setRemoteState({
                    eventId,
                    event: null,
                    status: "missing",
                })
                return
            }

            setRemoteState({
                eventId,
                event: nextEvent,
                status: "loaded",
            })
            useCalendarStore.getState().upsertEventSnapshot(nextEvent)
        })

        return () => {
            cancelled = true
        }
    }, [eventId, shouldFetch])

    const isLoading =
        shouldFetch &&
        (remoteState.eventId !== eventId || remoteState.status === "loading")
    const isMissing =
        shouldFetch &&
        remoteState.eventId === eventId &&
        remoteState.status === "missing"

    return {
        event,
        isLoading,
        isMissing,
    }
}
