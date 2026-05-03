import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { getCalendarEventRenderId } from "@/lib/calendar/recurrence"
import type { CalendarEventLayout } from "@/lib/calendar/types"
import { toCalendarDay } from "@/lib/date"
import dayjs from "@/lib/dayjs"
import { shallow } from "@/store/createSSRStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import { Button } from "@workspace/ui/components/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@workspace/ui/components/popover"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { memo, useCallback, useMemo, useState } from "react"
import { EventItem, getEventPosition } from "./event-item"
import {
    getCalendarEventItemMetrics,
    type CalendarEventItemMetrics,
} from "./event-item-layout.constants"
import type { PositionedCalendarEvent } from "./event-positioning"

type PositionedSegment = {
    renderId: string
    event: PositionedCalendarEvent
    lane: number
    laneCount: number
    startIndex: number
    endIndex: number
    continuesFromPrevWeek: boolean
    continuesToNextWeek: boolean
    dragOffsetStart: number
}

const SPLIT_VISIBLE_EVENT_LIMIT = 3
const DAY_MS = 1000 * 60 * 60 * 24

export const EventRow = memo(function EventRow({
    events,
    isMobile,
    week,
    size,
    assumeWeekScoped = false,
}: {
    events: PositionedCalendarEvent[]
    isMobile: boolean
    week: Date[]
    size?: number
    assumeWeekScoped?: boolean
}) {
    const t = useDebugTranslations("event.row")
    const {
        calendarTz,
        eventLayout,
        dragMode,
        dragRenderId,
        resizePinnedLane,
        resizeLayoutWeekStart,
    } = useCalendarStore(
        (s) => ({
            calendarTz: s.calendarTimezone,
            eventLayout: s.eventLayout,
            dragMode: s.drag.mode,
            dragRenderId: s.drag.renderId,
            resizePinnedLane: s.drag.resizePinnedLane,
            resizeLayoutWeekStart: s.drag.resizeLayoutWeekStart,
        }),
        shallow
    )

    const weekStart = useMemo(
        () => toCalendarDay(week[0]!, calendarTz),
        [week, calendarTz]
    )

    const weekEndExclusive = useMemo(
        () =>
            dayjs(week[week.length - 1]!)
                .tz(calendarTz)
                .startOf("day")
                .add(1, "day")
                .valueOf(),
        [week, calendarTz]
    )

    const eventItemMetrics = useMemo(
        () => getCalendarEventItemMetrics(isMobile),
        [isMobile]
    )

    const segments: PositionedSegment[] = useMemo(() => {
        const visible = (
            assumeWeekScoped
                ? events
                : events.filter((event) => {
                      return (
                          event.endCalExclusive > weekStart &&
                          event.startCal < weekEndExclusive
                      )
                  })
        )
            .map((event) => {
                const segmentStart = Math.max(event.startCal, weekStart)
                const segmentEndExclusive = Math.min(
                    event.endCalExclusive,
                    weekEndExclusive
                )

                const startIndex = Math.floor(
                    (segmentStart - weekStart) / DAY_MS
                )
                const endIndex =
                    Math.floor((segmentEndExclusive - weekStart) / DAY_MS) - 1

                return {
                    renderId: getCalendarEventRenderId(event),
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

                return a.renderId.localeCompare(b.renderId)
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

            const isResizePinForThisWeek =
                resizePinnedLane !== null &&
                resizeLayoutWeekStart !== null &&
                weekStart === resizeLayoutWeekStart &&
                dragRenderId !== null &&
                (dragMode === "resize-start" || dragMode === "resize-end")

            const pinnedInGroup = isResizePinForThisWeek
                ? group.find((segment) => segment.renderId === dragRenderId)
                : null

            const pinLane = resizePinnedLane ?? 0
            const othersOrdered = pinnedInGroup
                ? group.filter((segment) => segment !== pinnedInGroup)
                : group

            if (pinnedInGroup && resizePinnedLane !== null) {
                while (laneEndsExclusive.length <= pinLane) {
                    laneEndsExclusive.push(0)
                }
                laneEndsExclusive[pinLane] = pinnedInGroup.endExclusiveIndex
            }

            othersOrdered.forEach((segment) => {
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
                    renderId: segment.renderId,
                    lane,
                    laneCount: 1,
                    startIndex: segment.startIndex,
                    endIndex: segment.endIndex,
                    continuesFromPrevWeek: segment.continuesFromPrevWeek,
                    continuesToNextWeek: segment.continuesToNextWeek,
                    dragOffsetStart: segment.dragOffsetStart,
                })
            })

            if (pinnedInGroup && resizePinnedLane !== null) {
                groupRows.push({
                    event: pinnedInGroup.event,
                    renderId: pinnedInGroup.renderId,
                    lane: resizePinnedLane,
                    laneCount: 1,
                    startIndex: pinnedInGroup.startIndex,
                    endIndex: pinnedInGroup.endIndex,
                    continuesFromPrevWeek: pinnedInGroup.continuesFromPrevWeek,
                    continuesToNextWeek: pinnedInGroup.continuesToNextWeek,
                    dragOffsetStart: pinnedInGroup.dragOffsetStart,
                })
            }

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
    }, [
        dragMode,
        dragRenderId,
        events,
        resizeLayoutWeekStart,
        resizePinnedLane,
        assumeWeekScoped,
        weekEndExclusive,
        weekStart,
    ])

    const laneCapacity = useMemo(() => {
        if (eventLayout === "split") {
            return SPLIT_VISIBLE_EVENT_LIMIT
        }

        const weekHeight = size ?? 0
        const availableHeight = Math.max(
            0,
            weekHeight -
                eventItemMetrics.rowTopOffset -
                eventItemMetrics.rowBottomOffset
        )

        return Math.max(
            1,
            Math.floor(
                (availableHeight + eventItemMetrics.laneGap) /
                    eventItemMetrics.stride
            )
        )
    }, [
        eventItemMetrics.laneGap,
        eventItemMetrics.rowBottomOffset,
        eventItemMetrics.rowTopOffset,
        eventItemMetrics.stride,
        eventLayout,
        size,
    ])

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
        const dayCount = Math.max(1, week.length)
        const nextVisible: PositionedSegment[] = []
        const nextOverflowByDay = Array.from(
            { length: dayCount },
            () => [] as PositionedSegment[]
        )

        segments.forEach((segment) => {
            if (segment.lane < visibleLaneLimit) {
                nextVisible.push(segment)
                return
            }

            for (
                let dayIndex = segment.startIndex;
                dayIndex <= segment.endIndex;
                dayIndex += 1
            ) {
                if (dayIndex >= 0 && dayIndex < dayCount) {
                    nextOverflowByDay[dayIndex]?.push(segment)
                }
            }
        })

        return {
            visibleSegments: nextVisible,
            overflowByDay: nextOverflowByDay,
        }
    }, [segments, visibleLaneLimit, week.length])

    return (
        <div
            className="pointer-events-none absolute inset-x-0"
            style={getEventRowStyle(eventItemMetrics)}
        >
            {visibleSegments.map(
                ({
                    renderId,
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
                        key={`w${weekStart}-${renderId}-o${dragOffsetStart}-L${lane}`}
                        event={event}
                        isMobile={isMobile}
                        top={lane}
                        startIndex={startIndex}
                        endIndex={endIndex}
                        columnCount={week.length}
                        continuesFromPrevWeek={continuesFromPrevWeek}
                        continuesToNextWeek={continuesToNextWeek}
                        dragOffsetStart={dragOffsetStart}
                        laneCount={laneCount}
                        displayLaneCount={splitDisplayLaneCount}
                        layoutWeekStart={weekStart}
                    />
                )
            )}
            {overflowByDay.map((hiddenSegments, dayIndex) => {
                if (hiddenSegments.length === 0) {
                    return null
                }

                return (
                    <OverflowButton
                        key={`overflow-${weekStart}-${dayIndex}`}
                        dayIndex={dayIndex}
                        dayCount={week.length}
                        hiddenSegments={hiddenSegments}
                        isMobile={isMobile}
                        eventLayout={eventLayout}
                        topIndex={visibleLaneLimit}
                        splitDisplayLaneCount={splitDisplayLaneCount}
                        weekStart={weekStart}
                        eventItemMetrics={eventItemMetrics}
                    />
                )
            })}
        </div>
    )
})

function getEventRowStyle(eventItemMetrics: CalendarEventItemMetrics) {
    return {
        top: `${eventItemMetrics.rowTopOffset}px`,
        bottom: `${eventItemMetrics.rowBottomOffset}px`,
    }
}

const OverflowButton = memo(function OverflowButton({
    dayIndex,
    dayCount,
    hiddenSegments,
    isMobile,
    eventLayout,
    topIndex,
    splitDisplayLaneCount,
    weekStart,
    eventItemMetrics,
}: {
    dayIndex: number
    dayCount: number
    hiddenSegments: PositionedSegment[]
    isMobile: boolean
    eventLayout: CalendarEventLayout
    topIndex: number
    splitDisplayLaneCount: number
    weekStart: number
    eventItemMetrics: CalendarEventItemMetrics
}) {
    const t = useDebugTranslations("event.row")
    const [open, setOpen] = useState(false)
    const pos = getOverflowPosition(dayIndex, dayCount, isMobile)
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
                  top: `calc(${(topIndex / splitDisplayLaneCount) * 100}% + ${eventItemMetrics.laneGap}px)`,
                  height: `calc(${100 / splitDisplayLaneCount}% - ${eventItemMetrics.laneGap * 2}px)`,
              }
            : {
                  ...pos,
                  top: `${topIndex * eventItemMetrics.stride}px`,
                  height: `${eventItemMetrics.height}px`,
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
                    {t("hiddenCount", { count: hiddenSegments.length })}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="center"
                className="w-(--radix-popover-trigger-width) min-w-(--radix-popover-trigger-width) gap-0 p-0"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <div className="p-1.5 text-xs font-medium text-muted-foreground">
                    {t("hiddenEvents", { count: hiddenSegments.length })}
                </div>
                <ScrollArea>
                    <div className="max-h-30">
                        <div className="flex flex-col gap-1 p-1.5 pt-0">
                            {hiddenSegments.map(
                                ({
                                    renderId,
                                    event,
                                    startIndex,
                                    endIndex,
                                    continuesFromPrevWeek,
                                    continuesToNextWeek,
                                    dragOffsetStart,
                                }) => (
                                    <div
                                        key={`w${weekStart}-${renderId}-o${dragOffsetStart}-hidden`}
                                        className="relative"
                                    >
                                        <EventItem
                                            event={event}
                                            isMobile={isMobile}
                                            top={0}
                                            startIndex={startIndex}
                                            endIndex={endIndex}
                                            columnCount={dayCount}
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

function getOverflowPosition(
    dayIndex: number,
    dayCount: number,
    isMobile: boolean
) {
    return getEventPosition(dayIndex, dayIndex, isMobile, dayCount)
}
