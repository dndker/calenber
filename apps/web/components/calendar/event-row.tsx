import { toCalendarDay, toCalendarRange } from "@/lib/date"
import dayjs from "@/lib/dayjs"
import { CalendarEvent, useCalendarStore } from "@/store/useCalendarStore"
import { memo, useMemo } from "react"
import { EventItem } from "./event-item"

type PositionedEvent = CalendarEvent & {
    startCal: number
    endCal: number
}

type PositionedRow = {
    event: PositionedEvent
    top: number
}

export const EventRow = memo(function EventRow({ week }: { week: Date[] }) {
    const events = useCalendarStore((s) => s.events)
    const calendarTz = useCalendarStore((s) => s.calendarTimezone)

    const weekStart = useMemo(
        () => toCalendarDay(week[0]!, calendarTz),
        [week, calendarTz]
    )

    const weekEnd = useMemo(
        () => dayjs(week[6]!).tz(calendarTz).endOf("day").valueOf(),
        [week, calendarTz]
    )

    /**
     * 🔥 핵심: timezone 변환 1번만 수행
     */
    const positionedEvents: PositionedEvent[] = useMemo(() => {
        return events.map((e) => {
            const { startDay, endDay } = toCalendarRange(e, calendarTz)

            return {
                ...e,
                startCal: startDay.valueOf(),
                endCal: endDay.add(1, "day").valueOf(), // 🔥 inclusive 처리
            }
        })
    }, [events, calendarTz])

    /**
     * ✅ 필터링 (calendar 기준)
     */
    const filtered = useMemo(() => {
        return positionedEvents.filter((e) => {
            return e.endCal > weekStart && e.startCal < weekEnd
        })
    }, [positionedEvents, weekStart, weekEnd])

    /**
     * ✅ 정렬
     */
    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            const aDur = a.endCal - a.startCal
            const bDur = b.endCal - b.startCal

            if (bDur !== aDur) return bDur - aDur
            if (a.startCal !== b.startCal) return a.startCal - b.startCal

            return a.id.localeCompare(b.id)
        })
    }, [filtered])

    /**
     * ✅ lane 계산
     */
    const rows: PositionedRow[] = useMemo(() => {
        const lanes: PositionedEvent[][] = []
        const result: PositionedRow[] = []

        sorted.forEach((event) => {
            let placed = false

            for (let i = 0; i < lanes.length; i++) {
                if (!lanes[i]!.some((e) => isOverlap(e, event))) {
                    lanes[i]!.push(event)
                    result.push({ event, top: i })
                    placed = true
                    break
                }
            }

            if (!placed) {
                lanes.push([event])
                result.push({ event, top: lanes.length - 1 })
            }
        })

        return result
    }, [sorted])

    return (
        <div className="pointer-events-none absolute top-14 right-0 left-0">
            {rows.map(({ event, top }) => (
                <EventItem
                    key={event.id}
                    event={event} // 🔥 기존 event 그대로 전달
                    week={week}
                    top={top}
                />
            ))}
        </div>
    )
})

function isOverlap(a: PositionedEvent, b: PositionedEvent) {
    return a.startCal < b.endCal && b.startCal < a.endCal
}
