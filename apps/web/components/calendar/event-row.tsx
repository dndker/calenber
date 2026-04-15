import { toCalendarDay, toCalendarRange } from "@/lib/date"
import dayjs from "@/lib/dayjs"
import type { CalendarEventLayout } from "@/lib/calendar/types"
import {
    CalendarEvent,
    useCalendarStore,
} from "@/store/useCalendarStore"
import { memo, useMemo } from "react"
import { EventItem } from "./event-item"

type PositionedEvent = CalendarEvent & {
    startCal: number
    endCalExclusive: number
}

type PositionedSegment = {
    event: PositionedEvent
    lane: number
    laneCount: number
    startIndex: number
    endIndex: number
    dragOffsetStart: number
}

export const EventRow = memo(function EventRow({ week }: { week: Date[] }) {
    const events = useCalendarStore((s) => s.events)
    const calendarTz = useCalendarStore((s) => s.calendarTimezone)
    const eventLayout = useCalendarStore((s) => s.eventLayout)

    const weekStart = useMemo(
        () => toCalendarDay(week[0]!, calendarTz),
        [week, calendarTz]
    )

    const weekEndExclusive = useMemo(
        () => dayjs(week[6]!).tz(calendarTz).startOf("day").add(1, "day").valueOf(),
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
                endCalExclusive: endDay.add(1, "day").valueOf(),
            }
        })
    }, [events, calendarTz])

    const segments: PositionedSegment[] = useMemo(() => {
        const visible = positionedEvents
            .filter((event) => {
                return (
                    event.endCalExclusive > weekStart &&
                    event.startCal < weekEndExclusive
                )
            })
            .map((event) => {
                const segmentStart = Math.max(event.startCal, weekStart)
                const segmentEndExclusive = Math.min(
                    event.endCalExclusive,
                    weekEndExclusive
                )

                const startIndex = dayjs(segmentStart)
                    .diff(dayjs(weekStart), "day")
                const endIndex =
                    dayjs(segmentEndExclusive).diff(dayjs(weekStart), "day") - 1

                return {
                    event,
                    startIndex,
                    endIndex,
                    dragOffsetStart: dayjs(segmentStart).diff(
                        dayjs(event.startCal),
                        "day"
                    ),
                    endExclusiveIndex: endIndex + 1,
                    span: endIndex - startIndex + 1,
                }
            })
            .sort((a, b) => {
                if (a.startIndex !== b.startIndex) {
                    return a.startIndex - b.startIndex
                }

                if (b.span !== a.span) {
                    return b.span - a.span
                }

                return a.event.id.localeCompare(b.event.id)
            })

        const result: PositionedSegment[] = []
        let groupStart = 0

        while (groupStart < visible.length) {
            let groupEnd = groupStart + 1
            let groupMaxEndExclusive = visible[groupStart]!.endExclusiveIndex

            while (groupEnd < visible.length) {
                const next = visible[groupEnd]!

                if (next.startIndex >= groupMaxEndExclusive) {
                    break
                }

                groupMaxEndExclusive = Math.max(
                    groupMaxEndExclusive,
                    next.endExclusiveIndex
                )
                groupEnd += 1
            }

            const group = visible.slice(groupStart, groupEnd)
            const laneEndsExclusive: number[] = []
            const groupRows: PositionedSegment[] = []

            group.forEach((segment) => {
                let lane = laneEndsExclusive.findIndex(
                    (laneEndExclusive) => segment.startIndex >= laneEndExclusive
                )

                if (lane === -1) {
                    lane = laneEndsExclusive.length
                    laneEndsExclusive.push(segment.endExclusiveIndex)
                } else {
                    laneEndsExclusive[lane] = segment.endExclusiveIndex
                }

                groupRows.push({
                    event: segment.event,
                    lane,
                    laneCount: 1,
                    startIndex: segment.startIndex,
                    endIndex: segment.endIndex,
                    dragOffsetStart: segment.dragOffsetStart,
                })
            })

            const laneCount = laneEndsExclusive.length || 1

            groupRows.forEach((row) => {
                result.push({
                    ...row,
                    laneCount,
                })
            })

            groupStart = groupEnd
        }

        return result
    }, [positionedEvents, weekStart, weekEndExclusive])

    return (
        <div className={memoEventRowClass(eventLayout)}>
            {segments.map(
                ({
                    event,
                    lane,
                    laneCount,
                    startIndex,
                    endIndex,
                    dragOffsetStart,
                }) => (
                <EventItem
                    key={`${event.id}-${startIndex}-${endIndex}`}
                    event={event}
                    top={lane}
                    startIndex={startIndex}
                    endIndex={endIndex}
                    dragOffsetStart={dragOffsetStart}
                    laneCount={laneCount}
                />
                )
            )}
        </div>
    )
})

function memoEventRowClass(layout: CalendarEventLayout) {
    return layout === "split"
        ? "pointer-events-none absolute inset-x-0 top-14 bottom-1"
        : "pointer-events-none absolute top-14 right-0 left-0"
}
