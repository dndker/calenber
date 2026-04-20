"use client"

import {
    getCachedCalendarEventHistory,
    loadCalendarEventHistory,
    type CalendarEventHistoryItem,
} from "@/lib/calendar/event-history"
import { useEffect, useState } from "react"

export function useCalendarEventHistory(
    eventId?: string,
    options?: {
        enabled?: boolean
        preloaded?: CalendarEventHistoryItem[] | null
    }
) {
    const enabled = options?.enabled ?? true
    const [historyState, setHistoryState] = useState<{
        eventId?: string
        history: CalendarEventHistoryItem[]
    }>(() => ({
        eventId,
        history:
            options?.preloaded ??
            (eventId ? getCachedCalendarEventHistory(eventId) ?? [] : []),
    }))
    const history =
        eventId == null
            ? []
            : historyState.eventId === eventId
              ? historyState.history
              : (options?.preloaded ??
                getCachedCalendarEventHistory(eventId) ??
                [])
    const [isLoading, setIsLoading] = useState(
        Boolean(enabled && eventId && history.length === 0)
    )

    useEffect(() => {
        if (!eventId || !enabled) {
            setIsLoading(false)
            return
        }

        const cached = getCachedCalendarEventHistory(eventId)

        if (cached) {
            setHistoryState({
                eventId,
                history: cached,
            })
            setIsLoading(false)
            return
        }

        let cancelled = false
        setIsLoading(true)

        void loadCalendarEventHistory(eventId)
            .then((nextHistory) => {
                if (cancelled) {
                    return
                }

                setHistoryState({
                    eventId,
                    history: nextHistory,
                })
            })
            .catch((error) => {
                if (cancelled) {
                    return
                }

                console.error("Failed to load calendar event history:", error)
                setHistoryState({
                    eventId,
                    history: [],
                })
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoading(false)
                }
            })

        return () => {
            cancelled = true
        }
    }, [enabled, eventId])

    return {
        history,
        isLoading,
    }
}
