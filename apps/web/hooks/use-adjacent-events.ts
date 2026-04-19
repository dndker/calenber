import { useCalendarStore } from "@/store/useCalendarStore"
import { useMemo } from "react"

export function useAdjacentEvents(eventId: string) {
    const events = useCalendarStore((s) => s.events)

    const { sortedEvents, indexMap } = useMemo(() => {
        // ✅ 1. 정렬 (한 번만)
        const sorted = [...events].sort(
            (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
        )

        // ✅ 2. id → index 매핑 (O(n))
        const map = new Map<string, number>()
        sorted.forEach((event, index) => {
            map.set(event.id, index)
        })

        return {
            sortedEvents: sorted,
            indexMap: map,
        }
    }, [events])

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
