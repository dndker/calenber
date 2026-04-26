import { useCalendarStore } from "@/store/useCalendarStore"
import { useCalendarSubscriptionEvents } from "@/hooks/use-calendar-subscription-events"
import { useMemo } from "react"

export function useAdjacentEvents({
    eventId,
    eventStart,
}: {
    eventId: string
    eventStart?: number
}) {
    const events = useCalendarStore((s) => s.events)
    const calendarTimezone = useCalendarStore((s) => s.calendarTimezone)
    const eventStarts = useMemo(
        () => events.map((event) => event.start),
        [events]
    )
    const minStart = useMemo(() => {
        const candidates =
            eventStart !== undefined ? [...eventStarts, eventStart] : eventStarts
        return candidates.length > 0 ? Math.min(...candidates) : Date.now()
    }, [eventStart, eventStarts])
    const maxStart = useMemo(() => {
        const candidates =
            eventStart !== undefined ? [...eventStarts, eventStart] : eventStarts
        return candidates.length > 0 ? Math.max(...candidates) : Date.now()
    }, [eventStart, eventStarts])
    const subscriptionEvents = useCalendarSubscriptionEvents({
        rangeStart: minStart - 370 * 24 * 60 * 60 * 1000,
        rangeEnd: maxStart + 370 * 24 * 60 * 60 * 1000,
        timezone: calendarTimezone,
    })
    const allEvents = useMemo(
        () => [...events, ...subscriptionEvents],
        [events, subscriptionEvents]
    )

    const { sortedEvents, indexMap } = useMemo(() => {
        // 정렬 비교에서 Date 객체를 만들지 않아 GC/CPU 부담을 줄인다.
        const sorted = [...allEvents].sort((a, b) => {
            if (a.start !== b.start) {
                return a.start - b.start
            }

            return a.id.localeCompare(b.id)
        })

        // ✅ 2. id → index 매핑 (O(n))
        const map = new Map<string, number>()
        sorted.forEach((event, index) => {
            map.set(event.id, index)
        })

        return {
            sortedEvents: sorted,
            indexMap: map,
        }
    }, [allEvents])

    return useMemo(() => {
        if (!sortedEvents.length) {
            return {
                prevEvent: null,
                nextEvent: null,
                hasPrev: false,
                hasNext: false,
            }
        }

        // ✅ O(1) 조회
        const index = indexMap.get(eventId)

        if (index === undefined) {
            return {
                prevEvent: null,
                nextEvent: null,
                hasPrev: false,
                hasNext: false,
            }
        }

        const prevEvent = index > 0 ? sortedEvents[index - 1] : null
        const nextEvent =
            index < sortedEvents.length - 1 ? sortedEvents[index + 1] : null

        return {
            prevEvent,
            nextEvent,
            hasPrev: !!prevEvent,
            hasNext: !!nextEvent,
        }
    }, [eventId, sortedEvents, indexMap])
}
