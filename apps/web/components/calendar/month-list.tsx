import { lockCalendarBodyCursor } from "@/lib/calendar/body-cursor-lock"
import { useCalendarSubscriptionEvents } from "@/hooks/use-calendar-subscription-events"
import {
    expandCalendarEventsForRange,
    getCalendarEventRenderId,
    getCalendarVisibleEventRange,
} from "@/lib/calendar/recurrence"
import {
    getCalendarWeekStart,
    normalizeCalendarLayoutOptions,
} from "@/lib/calendar/layout-options"
import { toCalendarRange } from "@/lib/date"
import dayjs from "@/lib/dayjs"
import { shallow } from "@/store/createSSRStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import {
    CENTER_INDEX,
    TOTAL,
    getMonthKey,
    getWeek,
    getWeekOffset,
} from "@/utils/calendar"
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    pointerWithin,
    useSensor,
    useSensors,
} from "@dnd-kit/core"
import { useVirtualizer } from "@tanstack/react-virtual"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { EventItem } from "./event-item"
import {
    positionCalendarEvents,
    type PositionedCalendarEvent,
} from "./event-positioning"
import { WeekRow } from "./week-row"

export function MonthList({
    parentRef,
    containerHeight,
    targetDate,
    onVisibleMonthChange,
}: {
    parentRef: React.RefObject<HTMLDivElement | null>
    containerHeight: number
    targetDate?: Date
    onVisibleMonthChange?: (date: Date) => void
}) {
    const events = useCalendarStore((s) => s.events)
    const calendarTz = useCalendarStore((s) => s.calendarTimezone)
    const weekStartsOn = useCalendarStore((s) =>
        normalizeCalendarLayoutOptions(s.activeCalendar?.layoutOptions).weekStartsOn
    )
    const hideWeekendColumns = useCalendarStore((s) =>
        normalizeCalendarLayoutOptions(s.activeCalendar?.layoutOptions)
            .hideWeekendColumns
    )
    const eventFilters = useCalendarStore((s) => s.eventFilters, shallow)
    const newDate = getCalendarWeekStart(new Date(), calendarTz, weekStartsOn).toDate()
    const baseDateRef = useRef(newDate)
    const prevMonthRef = useRef<string | null>(null)
    const dragFrameRef = useRef<number | null>(null)
    const dragCursorReleaseRef = useRef<(() => void) | null>(null)
    const lastOverIdRef = useRef<string | null>(null)
    const snapUnlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
        null
    )
    const [currentMonthKey, setCurrentMonthKey] = useState(
        getMonthKey(newDate, calendarTz)
    )

    useEffect(() => {
        baseDateRef.current = getCalendarWeekStart(
            new Date(),
            calendarTz,
            weekStartsOn
        ).toDate()
    }, [calendarTz, weekStartsOn])

    const itemSize = useMemo(
        () => Math.floor(containerHeight / 5),
        [containerHeight]
    )

    const virtualizer = useVirtualizer({
        count: TOTAL,
        getScrollElement: () => parentRef.current,
        estimateSize: () => itemSize,
        overscan: 10,
        gap: 1,
    })
    const items = virtualizer.getVirtualItems()

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                // delay: 50,
                // tolerance: 5,
                distance: 5,
            },
        })
    )

    // 초기 위치
    useEffect(() => {
        const base = baseDateRef.current

        const firstDayOfMonth = dayjs.tz(newDate, calendarTz).startOf("month")
        const firstWeekStart = getCalendarWeekStart(
            firstDayOfMonth.toDate(),
            calendarTz,
            weekStartsOn
        )

        const diff = firstWeekStart.diff(dayjs.tz(base, calendarTz), "week")

        virtualizer.scrollToIndex(CENTER_INDEX + diff, {
            align: "start",
        })

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [calendarTz])

    // 외부 이동
    useEffect(() => {
        if (!targetDate) return

        const base = baseDateRef.current

        const firstDayOfMonth = dayjs
            .tz(targetDate, calendarTz)
            .startOf("month")
        const firstWeekStart = getCalendarWeekStart(
            firstDayOfMonth.toDate(),
            calendarTz,
            weekStartsOn
        )
        const diff = firstWeekStart.diff(dayjs.tz(base, calendarTz), "week")

        virtualizer.scrollToIndex(CENTER_INDEX + diff, {
            align: "start",
        })

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [calendarTz, targetDate])

    // 현재 월 계산
    useEffect(() => {
        if (!items.length) return

        const middle = items[Math.floor(items.length / 2)]
        if (!middle) return

        const weekOffset = middle.index - CENTER_INDEX
        const date = getWeekOffset(
            baseDateRef.current,
            weekOffset,
            calendarTz,
            weekStartsOn
        )

        const monthKey = getMonthKey(date, calendarTz)
        if (prevMonthRef.current === monthKey) return

        prevMonthRef.current = monthKey

        setCurrentMonthKey(monthKey)
        onVisibleMonthChange?.(
            dayjs.tz(date, calendarTz).startOf("month").toDate()
        )
    }, [calendarTz, items, onVisibleMonthChange, weekStartsOn])

    // 스크롤 끝나면 스냅
    useEffect(() => {
        const el = parentRef.current
        if (!el) return

        let timeout: NodeJS.Timeout | null = null
        let isSnapping = false

        const handleScroll = () => {
            if (isSnapping) return

            if (timeout) clearTimeout(timeout)

            timeout = setTimeout(() => {
                const items = virtualizer.getVirtualItems()
                if (!items.length) return

                const scrollTop = el.scrollTop

                let closest = items[0]!
                let minDiff = Math.abs(items[0]!.start - scrollTop)

                for (const item of items) {
                    const diff = Math.abs(item.start - scrollTop)
                    if (diff < minDiff) {
                        minDiff = diff
                        closest = item
                    }
                }

                isSnapping = true

                virtualizer.scrollToIndex(closest.index, {
                    align: "start",
                    behavior: "smooth",
                })

                // smooth 끝났다고 가정하고 잠깐 후 unlock
                snapUnlockTimeoutRef.current = setTimeout(() => {
                    isSnapping = false
                }, 150)
            }, 100)
        }

        el.addEventListener("scroll", handleScroll)

        return () => {
            el.removeEventListener("scroll", handleScroll)
            if (timeout) clearTimeout(timeout)
            if (snapUnlockTimeoutRef.current) {
                clearTimeout(snapUnlockTimeoutRef.current)
                snapUnlockTimeoutRef.current = null
            }
        }
    }, [virtualizer, parentRef])
    const visibleRange = useMemo(() => {
        const currentMonth = dayjs
            .tz(`${currentMonthKey}-01`, calendarTz)
            .valueOf()
        if (Number.isNaN(currentMonth)) {
            return null
        }

        return getCalendarVisibleEventRange(currentMonth, calendarTz)
    }, [calendarTz, currentMonthKey])

    const filteredEvents = useMemo(() => {
        if (
            eventFilters.excludedStatuses.length === 0 &&
            eventFilters.excludedCategoryIds.length === 0
        ) {
            return events
        }

        const excludedStatuses = new Set(eventFilters.excludedStatuses)
        const excludedCategoryIds = new Set(eventFilters.excludedCategoryIds)

        return events.filter((event) => {
            if (excludedStatuses.has(event.status)) {
                return false
            }

            if (
                excludedCategoryIds.size === 0 ||
                event.categoryIds.length === 0
            ) {
                return true
            }

            return event.categoryIds.some(
                (categoryId) => !excludedCategoryIds.has(categoryId)
            )
        })
    }, [eventFilters, events])
    const expandedEvents = useMemo(() => {
        if (!visibleRange) {
            return []
        }

        return expandCalendarEventsForRange(filteredEvents, {
            rangeStart: visibleRange.start,
            rangeEnd: visibleRange.end,
            calendarTz,
        })
    }, [calendarTz, filteredEvents, visibleRange])
    const subscriptionEvents = useCalendarSubscriptionEvents({
        rangeStart: visibleRange?.start ?? 0,
        rangeEnd: visibleRange?.end ?? 0,
        timezone: calendarTz,
    })
    const mergedExpandedEvents = useMemo(
        () => [...expandedEvents, ...subscriptionEvents],
        [expandedEvents, subscriptionEvents]
    )
    const dragMode = useCalendarStore((s) => s.drag.mode)
    const dragStart = useCalendarStore((s) => s.drag.start)
    const dragEnd = useCalendarStore((s) => s.drag.end)
    const dragRenderId = useCalendarStore((s) => s.drag.renderId)
    const draggingEvent = useCalendarStore((s) => s.drag.previewEvent)
    const dragAdjustedEvents = useMemo(() => {
        if (
            (dragMode !== "resize-start" && dragMode !== "resize-end") ||
            !draggingEvent ||
            !dragRenderId ||
            !dragStart ||
            !dragEnd
        ) {
            return mergedExpandedEvents
        }

        return mergedExpandedEvents.map((event) => {
            if (getCalendarEventRenderId(event) !== dragRenderId) {
                return event
            }

            return {
                ...event,
                start: dragStart,
                end: dragEnd,
            }
        })
    }, [
        dragEnd,
        dragMode,
        dragRenderId,
        dragStart,
        draggingEvent,
        mergedExpandedEvents,
    ])
    const positionedEvents = useMemo(
        () => positionCalendarEvents(dragAdjustedEvents, calendarTz),
        [calendarTz, dragAdjustedEvents]
    )
    const positionedEventsByWeek = useMemo(() => {
        const buckets = new Map<number, PositionedCalendarEvent[]>()

        for (const item of items) {
            const weekOffset = item.index - CENTER_INDEX
            const weekDate = getWeekOffset(
                baseDateRef.current,
                weekOffset,
                calendarTz,
                weekStartsOn
            )
            const week = getWeek(weekDate, calendarTz, weekStartsOn)
            const visibleWeek = hideWeekendColumns
                ? week.filter((day) => {
                      const weekday = day.getDay()
                      return weekday !== 0 && weekday !== 6
                  })
                : week
            const firstDay = visibleWeek[0]
            const lastDay = visibleWeek[visibleWeek.length - 1]

            if (!firstDay || !lastDay) {
                buckets.set(item.index, [])
                continue
            }

            const weekStart = dayjs(firstDay)
                .tz(calendarTz)
                .startOf("day")
                .valueOf()
            const weekEndExclusive = dayjs(lastDay)
                .tz(calendarTz)
                .startOf("day")
                .add(1, "day")
                .valueOf()

            buckets.set(
                item.index,
                positionedEvents.filter(
                    (event) =>
                        event.endCalExclusive > weekStart &&
                        event.startCal < weekEndExclusive
                )
            )
        }

        return buckets
    }, [calendarTz, hideWeekendColumns, items, positionedEvents, weekStartsOn])

    const handleDragOver = useCallback(
        ({ over }: { over: { id: string | number } | null }) => {
            if (useCalendarStore.getState().drag.mode !== "move") {
                return
            }
            if (!over) return

            const overId = String(over.id)

            if (lastOverIdRef.current === overId) {
                return
            }

            lastOverIdRef.current = overId

            if (dragFrameRef.current) {
                cancelAnimationFrame(dragFrameRef.current)
            }

            dragFrameRef.current = requestAnimationFrame(() => {
                const date = dayjs
                    .tz(overId, calendarTz)
                    .startOf("day")
                    .valueOf()

                useCalendarStore.getState().moveDrag(date)
            })
        },
        [calendarTz]
    )

    const handleDragStart = useCallback(() => {
        dragCursorReleaseRef.current?.()
        dragCursorReleaseRef.current = lockCalendarBodyCursor(
            "month-list-move",
            "grabbing"
        )
    }, [])

    const finishDragSession = useCallback(() => {
        lastOverIdRef.current = null

        if (dragFrameRef.current) {
            cancelAnimationFrame(dragFrameRef.current)
            dragFrameRef.current = null
        }
        dragCursorReleaseRef.current?.()
        dragCursorReleaseRef.current = null

        useCalendarStore.getState().endDrag()
    }, [])

    useEffect(() => {
        return () => {
            if (dragFrameRef.current) {
                cancelAnimationFrame(dragFrameRef.current)
            }
            if (snapUnlockTimeoutRef.current) {
                clearTimeout(snapUnlockTimeoutRef.current)
                snapUnlockTimeoutRef.current = null
            }
            dragCursorReleaseRef.current?.()
            dragCursorReleaseRef.current = null
        }
    }, [])

    return (
        <DndContext
            collisionDetection={pointerWithin}
            sensors={sensors}
            autoScroll={{
                threshold: {
                    x: 0, // x축 임계값을 0으로 설정하여 감지 범위를 없애거나
                    y: 0.2, // y축만 활성화
                },
            }}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={finishDragSession}
            onDragCancel={finishDragSession}
        >
            <div
                style={{
                    height: virtualizer.getTotalSize(),
                    position: "relative",
                }}
            >
                {items.map((item) => {
                    const weekOffset = item.index - CENTER_INDEX
                    const weekDate = getWeekOffset(
                        baseDateRef.current,
                        weekOffset,
                        calendarTz,
                        weekStartsOn
                    )

                    return (
                        <WeekRow
                            key={item.key}
                            events={
                                positionedEventsByWeek.get(item.index) ?? []
                            }
                            start={item.start}
                            size={item.size}
                            weekDate={weekDate}
                            currentMonthKey={currentMonthKey}
                        />
                    )
                })}
            </div>
            <DragOverlay
                dropAnimation={null}
                style={{ pointerEvents: "none", willChange: "transform" }}
            >
                <CalendarDragOverlay calendarTz={calendarTz} />
            </DragOverlay>
        </DndContext>
    )
}

const CalendarDragOverlay = memo(function CalendarDragOverlay({
    calendarTz,
}: {
    calendarTz: string
}) {
    const dragEventId = useCalendarStore((s) => s.drag.eventId)
    const dragMode = useCalendarStore((s) => s.drag.mode)
    const dragStart = useCalendarStore((s) => s.drag.start)
    const dragEnd = useCalendarStore((s) => s.drag.end)
    const dragSegmentOffset = useCalendarStore((s) => s.drag.segmentOffset)
    const draggingEvent = useCalendarStore((s) => s.drag.previewEvent)
    const weekStartsOn = useCalendarStore((s) =>
        normalizeCalendarLayoutOptions(s.activeCalendar?.layoutOptions).weekStartsOn
    )
    const hideWeekendColumns = useCalendarStore((s) =>
        normalizeCalendarLayoutOptions(s.activeCalendar?.layoutOptions)
            .hideWeekendColumns
    )

    if (
        !dragEventId ||
        !draggingEvent ||
        !dragStart ||
        !dragEnd ||
        dragMode !== "move"
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
    const segmentStartDay = startDay.add(dragSegmentOffset, "day")
    const overlayWeek = getWeek(segmentStartDay.toDate(), calendarTz, weekStartsOn)
    const visibleOverlayWeek = hideWeekendColumns
        ? overlayWeek.filter((day) => {
              const weekday = day.getDay()
              return weekday !== 0 && weekday !== 6
          })
        : overlayWeek
    const overlayFirstDay = visibleOverlayWeek[0]
    const overlayLastDay = visibleOverlayWeek[visibleOverlayWeek.length - 1]

    if (!overlayFirstDay || !overlayLastDay) {
        return null
    }

    const overlayWeekStart = dayjs(overlayFirstDay)
        .tz(calendarTz)
        .startOf("day")
    const overlayWeekEnd = dayjs(overlayLastDay).tz(calendarTz).startOf("day")
    const columnCount = visibleOverlayWeek.length
    const visibleSegmentEnd = endDay.isAfter(overlayWeekEnd, "day")
        ? overlayWeekEnd
        : endDay
    const startIndex = Math.max(
        0,
        segmentStartDay.diff(overlayWeekStart, "day")
    )
    const endIndex = Math.min(
        Math.max(0, columnCount - 1),
        visibleSegmentEnd.diff(overlayWeekStart, "day")
    )
    const continuesFromPrevWeek =
        segmentStartDay.isAfter(startDay, "day") ||
        startDay.isBefore(overlayWeekStart, "day")
    const continuesToNextWeek = endDay.isAfter(overlayWeekEnd, "day")

    return (
        <EventItem
            event={draggingEvent}
            top={0}
            startIndex={startIndex}
            endIndex={endIndex}
            columnCount={columnCount}
            continuesFromPrevWeek={continuesFromPrevWeek}
            continuesToNextWeek={continuesToNextWeek}
            overlay
        />
    )
})

export type { PositionedCalendarEvent }
