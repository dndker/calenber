import { CalendarEvent, useCalendarStore } from "@/store/useCalendarStore"
import { memo } from "react"
import { EventItem } from "./event-item"

type PositionedEvent = {
    event: CalendarEvent
    top: number
}

export const EventRow = memo(function EventRow({ week }: { week: Date[] }) {
    const events = useCalendarStore((s) => s.events)

    const weekStart = week[0]!.getTime()
    const weekEnd = week[6]!.getTime()

    const filtered = events.filter((e) => {
        return e.end > weekStart && e.start < weekEnd
    })

    const sorted = [...filtered].sort((a, b) => {
        const aDur = a.end - a.start
        const bDur = b.end - b.start

        if (bDur !== aDur) return bDur - aDur

        if (a.start !== b.start) return a.start - b.start

        return a.id.localeCompare(b.id)
    })

    const lanes: CalendarEvent[][] = []
    const rows: PositionedEvent[] = []

    sorted.forEach((event) => {
        let placed = false

        for (let i = 0; i < lanes.length; i++) {
            if (!lanes[i]!.some((e) => isOverlap(e, event))) {
                lanes[i]!.push(event)
                rows.push({ event, top: i })
                placed = true
                break
            }
        }

        if (!placed) {
            lanes.push([event])
            rows.push({ event, top: lanes.length - 1 })
        }
    })

    return (
        <div className="pointer-events-none absolute top-14 right-0 left-0">
            {rows.map(({ event, top }) => (
                <EventItem key={event.id} event={event} week={week} top={top} />
            ))}
        </div>
    )
})

function isOverlap(a: CalendarEvent, b: CalendarEvent) {
    return a.start < b.end && b.start < a.end
}
