import type { CalendarEventLayout } from "@/lib/calendar/types"
import { toCalendarDay, toCalendarRange } from "@/lib/date"
import dayjs from "@/lib/dayjs"
import { useCalendarStore } from "@/store/useCalendarStore"
import { Button } from "@workspace/ui/components/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@workspace/ui/components/popover"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { memo, useCallback, useMemo, useState } from "react"
import type { PositionedCalendarEvent } from "./event-positioning"
import { EventItem, getEventPosition } from "./event-item"

type PositionedSegment = {
    event: PositionedCalendarEvent
    lane: number
    laneCount: number
    startIndex: number
    endIndex: number
    continuesFromPrevWeek: boolean
    continuesToNextWeek: boolean
    dragOffsetStart: number
}

const EVENT_ROW_TOP_OFFSET = 56
const EVENT_ROW_BOTTOM_OFFSET = 4
const EVENT_ROW_HEIGHT = 28
const EVENT_ROW_GAP = 4
const EVENT_ROW_STRIDE = EVENT_ROW_HEIGHT + EVENT_ROW_GAP
const SPLIT_VISIBLE_EVENT_LIMIT = 3
const DAY_MS = 1000 * 60 * 60 * 24

export const EventRow = memo(function EventRow({
    events,
    week,
    size,
}: {
    events: PositionedCalendarEvent[]
    week: Date[]
    size?: number
}) {
    const calendarTz = useCalendarStore((s) => s.calendarTimezone)
    const eventLayout = useCalendarStore((s) => s.eventLayout)
    const dragEventId = useCalendarStore((s) => s.drag.eventId)
    const dragMode = useCalendarStore((s) => s.drag.mode)
    const dragStart = useCalendarStore((s) => s.drag.start)
    const dragEnd = useCalendarStore((s) => s.drag.end)
    const draggingEvent = useCalendarStore((s) =>
        s.drag.eventId ? s.events.find((event) => event.id === s.drag.eventId) : null
    )

    const weekStart = useMemo(
        () => toCalendarDay(week[0]!, calendarTz),
        [week, calendarTz]
    )

    const weekEndExclusive = useMemo(
        () =>
            dayjs(week[6]!)
                .tz(calendarTz)
                .startOf("day")
                .add(1, "day")
                .valueOf(),
        [week, calendarTz]
    )

    const segments: PositionedSegment[] = useMemo(() => {
        const visible = events
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

                const startIndex = Math.floor(
                    (segmentStart - weekStart) / DAY_MS
                )
                const endIndex = Math.floor(
                    (segmentEndExclusive - weekStart) / DAY_MS
                ) - 1

                return {
                    event,
                    startIndex,
                    endIndex,
                    continuesFromPrevWeek: event.startCal < weekStart,
                    continuesToNextWeek:
                        event.endCalExclusive > weekEndExclusive,
                    dragOffsetStart: Math.floor(
                        (segmentStart - event.startCal) / DAY_MS
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
                    continuesFromPrevWeek: segment.continuesFromPrevWeek,
                    continuesToNextWeek: segment.continuesToNextWeek,
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
    }, [events, weekStart, weekEndExclusive])

    const laneCapacity = useMemo(() => {
        if (eventLayout === "split") {
            return SPLIT_VISIBLE_EVENT_LIMIT
        }

        const weekHeight = size ?? 0
        const availableHeight = Math.max(
            0,
            weekHeight - EVENT_ROW_TOP_OFFSET - EVENT_ROW_BOTTOM_OFFSET
        )

        return Math.max(
            1,
            Math.floor((availableHeight + EVENT_ROW_GAP) / EVENT_ROW_STRIDE)
        )
    }, [eventLayout, size])

    const maxLaneCount = useMemo(() => {
        return segments.reduce((max, segment) => {
            return Math.max(max, segment.lane + 1)
        }, 0)
    }, [segments])

    const hasOverflow = maxLaneCount > laneCapacity
    const visibleLaneLimit =
        eventLayout === "split"
            ? laneCapacity
            : hasOverflow
              ? Math.max(0, laneCapacity - 1)
              : laneCapacity
    const splitDisplayLaneCount =
        eventLayout === "split"
            ? Math.max(
                  1,
                  hasOverflow
                      ? SPLIT_VISIBLE_EVENT_LIMIT + 1
                      : Math.min(maxLaneCount || 1, SPLIT_VISIBLE_EVENT_LIMIT)
              )
            : 1

    const { visibleSegments, overflowByDay } = useMemo(() => {
        const nextVisible: PositionedSegment[] = []
        const nextOverflowByDay = Array.from(
            { length: 7 },
            () => [] as PositionedSegment[]
        )

        segments.forEach((segment) => {
            if (
                dragMode &&
                dragMode !== "move" &&
                dragEventId === segment.event.id
            ) {
                return
            }

            if (segment.lane < visibleLaneLimit) {
                nextVisible.push(segment)
                return
            }

            for (
                let dayIndex = segment.startIndex;
                dayIndex <= segment.endIndex;
                dayIndex += 1
            ) {
                nextOverflowByDay[dayIndex]?.push(segment)
            }
        })

        return {
            visibleSegments: nextVisible,
            overflowByDay: nextOverflowByDay,
        }
    }, [dragEventId, dragMode, segments, visibleLaneLimit])

    const resizePreviewSegment = useMemo(() => {
        if (
            !dragEventId ||
            !draggingEvent ||
            !dragStart ||
            !dragEnd ||
            (dragMode !== "resize-start" && dragMode !== "resize-end")
        ) {
            return null
        }

        const { startDay, endDay } = toCalendarRange(
            {
                ...draggingEvent,
                start: dragStart,
                end: dragEnd,
            },
            calendarTz
        )
        const previewStart = startDay.valueOf()
        const previewEndExclusive = endDay.add(1, "day").valueOf()

        if (
            previewEndExclusive <= weekStart ||
            previewStart >= weekEndExclusive
        ) {
            return null
        }

        const segmentStart = Math.max(previewStart, weekStart)
        const segmentEndExclusive = Math.min(previewEndExclusive, weekEndExclusive)
        const startIndex = dayjs(segmentStart).diff(dayjs(weekStart), "day")
        const endIndex =
            dayjs(segmentEndExclusive).diff(dayjs(weekStart), "day") - 1
        const baseSegment = segments.find(
            (segment) => segment.event.id === dragEventId
        )

        return {
            event: draggingEvent,
            lane: baseSegment?.lane ?? 0,
            laneCount: baseSegment?.laneCount ?? 1,
            startIndex,
            endIndex,
            continuesFromPrevWeek: previewStart < weekStart,
            continuesToNextWeek: previewEndExclusive > weekEndExclusive,
            dragOffsetStart: dayjs(segmentStart).diff(dayjs(previewStart), "day"),
        }
    }, [
        calendarTz,
        dragEnd,
        dragEventId,
        dragMode,
        dragStart,
        draggingEvent,
        segments,
        weekEndExclusive,
        weekStart,
    ])

    return (
        <div className={memoEventRowClass()}>
            {visibleSegments.map(
                ({
                    event,
                    lane,
                    laneCount,
                    startIndex,
                    endIndex,
                    continuesFromPrevWeek,
                    continuesToNextWeek,
                    dragOffsetStart,
                }) => (
                    <EventItem
                        key={`${event.id}-${startIndex}-${endIndex}`}
                        event={event}
                        top={lane}
                        startIndex={startIndex}
                        endIndex={endIndex}
                        continuesFromPrevWeek={continuesFromPrevWeek}
                        continuesToNextWeek={continuesToNextWeek}
                        dragOffsetStart={dragOffsetStart}
                        laneCount={laneCount}
                        displayLaneCount={splitDisplayLaneCount}
                    />
                )
            )}
            {resizePreviewSegment && (
                <EventItem
                    key={`resize-preview-${resizePreviewSegment.event.id}-${resizePreviewSegment.startIndex}-${resizePreviewSegment.endIndex}`}
                    event={resizePreviewSegment.event}
                    top={resizePreviewSegment.lane}
                    startIndex={resizePreviewSegment.startIndex}
                    endIndex={resizePreviewSegment.endIndex}
                    continuesFromPrevWeek={
                        resizePreviewSegment.continuesFromPrevWeek
                    }
                    continuesToNextWeek={
                        resizePreviewSegment.continuesToNextWeek
                    }
                    dragOffsetStart={resizePreviewSegment.dragOffsetStart}
                    laneCount={resizePreviewSegment.laneCount}
                    interactive={false}
                />
            )}
            {overflowByDay.map((hiddenSegments, dayIndex) => {
                if (hiddenSegments.length === 0) {
                    return null
                }

                return (
                    <OverflowButton
                        key={`overflow-${dayIndex}`}
                        dayIndex={dayIndex}
                        hiddenSegments={hiddenSegments}
                        eventLayout={eventLayout}
                        topIndex={visibleLaneLimit}
                        splitDisplayLaneCount={splitDisplayLaneCount}
                    />
                )
            })}
        </div>
    )
})

function memoEventRowClass() {
    return "pointer-events-none absolute inset-x-0 top-14 bottom-1"
}

const OverflowButton = memo(function OverflowButton({
    dayIndex,
    hiddenSegments,
    eventLayout,
    topIndex,
    splitDisplayLaneCount,
}: {
    dayIndex: number
    hiddenSegments: PositionedSegment[]
    eventLayout: CalendarEventLayout
    topIndex: number
    splitDisplayLaneCount: number
}) {
    const [open, setOpen] = useState(false)
    const pos = getOverflowPosition(dayIndex)
    const handleDragStateChange = useCallback((isDragging: boolean) => {
        if (!isDragging) {
            return
        }

        setOpen(false)
    }, [])
    const handleOpenEvent = useCallback(() => {
        setOpen(false)
    }, [])
    const style =
        eventLayout === "split"
            ? {
                  ...pos,
                  top: `calc(${(topIndex / splitDisplayLaneCount) * 100}% + 2px)`,
                  height: `calc(${100 / splitDisplayLaneCount}% - 4px)`,
              }
            : {
                  ...pos,
                  top: `${topIndex * EVENT_ROW_STRIDE}px`,
                  height: `${EVENT_ROW_HEIGHT}px`,
              }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    className="pointer-events-auto absolute z-20 h-auto items-center justify-center px-1.5 py-0 text-center text-xs font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    style={{ ...style, bottom: 0, top: "auto" }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                >
                    +{hiddenSegments.length}개
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="center"
                className="w-(--radix-popover-trigger-width) min-w-(--radix-popover-trigger-width) gap-0 p-0"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <div className="p-1.5 text-xs font-medium text-muted-foreground">
                    숨겨진 일정 {hiddenSegments.length}개
                </div>
                <ScrollArea>
                    <div className="max-h-30">
                        <div className="flex flex-col gap-1 p-1.5 pt-0">
                            {hiddenSegments.map(
                                ({
                                    event,
                                    startIndex,
                                    endIndex,
                                    continuesFromPrevWeek,
                                    continuesToNextWeek,
                                    dragOffsetStart,
                                }) => (
                                    <div
                                        key={`${event.id}-${startIndex}-${endIndex}`}
                                        className="relative"
                                    >
                                        <EventItem
                                            event={event}
                                            top={0}
                                            startIndex={startIndex}
                                            endIndex={endIndex}
                                            continuesFromPrevWeek={
                                                continuesFromPrevWeek
                                            }
                                            continuesToNextWeek={
                                                continuesToNextWeek
                                            }
                                            dragOffsetStart={dragOffsetStart}
                                            laneCount={1}
                                            inline
                                            onDragStateChange={
                                                handleDragStateChange
                                            }
                                            onOpen={handleOpenEvent}
                                        />
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    )
})

function getOverflowPosition(dayIndex: number) {
    return getEventPosition(dayIndex, dayIndex)
}
