import dayjs from "@/lib/dayjs"
import { CalendarEvent, useCalendarStore } from "@/store/useCalendarStore"
import { memo } from "react"
import { EventItem } from "./event-item"

type PositionedEvent = {
    event: CalendarEvent
    top: number
}

export const EventRow = memo(function EventRow({ week }: { week: Date[] }) {
    const events = useCalendarStore((s) => s.events)

    const weekStart = dayjs(week[0]).startOf("day")
    const weekEnd = dayjs(week[6]).endOf("day")

    // 1. 해당 주 필터
    const filtered = events.filter((e) => {
        const start = dayjs(e.start)
        const end = dayjs(e.end)
        return end.isAfter(weekStart) && start.isBefore(weekEnd)
    })

    // 2. 긴 일정 우선 정렬
    const sorted = [...filtered].sort((a, b) => {
        const aDur = dayjs(a.end).diff(a.start)
        const bDur = dayjs(b.end).diff(b.start)

        if (bDur !== aDur) return bDur - aDur

        const aStart = dayjs(a.start).valueOf()
        const bStart = dayjs(b.start).valueOf()

        if (aStart !== bStart) return aStart - bStart

        return a.id.localeCompare(b.id)
    })

    // 3. stacking 계산
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
    const aStart = dayjs(a.start)
    const aEnd = dayjs(a.end)
    const bStart = dayjs(b.start)
    const bEnd = dayjs(b.end)

    return aStart.isBefore(bEnd) && bStart.isBefore(aEnd)
}
