import { useCalendarSubscriptionEvents } from "@/hooks/use-calendar-subscription-events"
import { lockCalendarBodyCursor } from "@/lib/calendar/body-cursor-lock"
import {
    filterCalendarWeekVisibleDays,
    getCalendarWeekStart,
    normalizeCalendarLayoutOptions,
} from "@/lib/calendar/layout-options"
import {
    expandCalendarEventsForRange,
    getCalendarEventRenderId,
    getCalendarVisibleEventRange,
} from "@/lib/calendar/recurrence"
import { toCalendarRange } from "@/lib/date"
import dayjs from "@/lib/dayjs"
import type { CalendarEvent } from "@/store/calendar-store.types"
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
    useSensor,
    useSensors,
} from "@dnd-kit/core"
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual"
import {
    useDeferredValue,
    memo,
    startTransition,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { EventItem } from "./event-item"
import {
    positionCalendarEvents,
    type PositionedCalendarEvent,
} from "./event-positioning"
import { WeekRow } from "./week-row"

const EMPTY_POSITIONED_WEEK_EVENTS: PositionedCalendarEvent[] = []

type VisibleWeekMeta = {
    item: VirtualItem
    visibleWeek: Date[]
    weekStart: number
    weekEndExclusive: number
}

export function MonthList({
    parentRef,
    containerHeight,
    isMobile,
    targetDate,
    onVisibleMonthChange,
}: {
    parentRef: React.RefObject<HTMLDivElement | null>
    containerHeight: number
    isMobile: boolean
    targetDate?: Date
    onVisibleMonthChange?: (date: Date) => void
}) {
    const {
        events,
        calendarTz,
        weekStartsOn,
        hideWeekendColumns,
        eventFilters,
    } = useCalendarStore((s) => {
        const layout = normalizeCalendarLayoutOptions(
            s.activeCalendar?.layoutOptions
        )
        return {
            events: s.events,
            calendarTz: s.calendarTimezone,
            weekStartsOn: layout.weekStartsOn,
            hideWeekendColumns: layout.hideWeekendColumns,
            eventFilters: s.eventFilters,
        }
    }, shallow)
    const newDate = getCalendarWeekStart(
        new Date(),
        calendarTz,
        weekStartsOn
    ).toDate()
    const baseDateRef = useRef(newDate)
    const prevMonthRef = useRef<string | null>(null)
    const prevItemSizeRef = useRef<number | null>(null)
    const dragFrameRef = useRef<number | null>(null)
    const dragCursorReleaseRef = useRef<(() => void) | null>(null)
    const lastOverIdRef = useRef<string | null>(null)
    const snapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [currentMonthKey, setCurrentMonthKey] = useState(
        getMonthKey(newDate, calendarTz)
    )
    const [rangeAnchorMonthKey, setRangeAnchorMonthKey] = useState(
        getMonthKey(newDate, calendarTz)
    )

    useEffect(() => {
        baseDateRef.current = getCalendarWeekStart(
            new Date(),
            calendarTz,
            weekStartsOn
        ).toDate()
    }, [calendarTz, weekStartsOn])

    useEffect(() => {
        const monthKey = getMonthKey(baseDateRef.current, calendarTz)
        prevMonthRef.current = monthKey
        setCurrentMonthKey(monthKey)
        setRangeAnchorMonthKey(monthKey)
    }, [calendarTz, weekStartsOn])

    const deferredContainerHeight = useDeferredValue(containerHeight)
    const itemSize = useMemo(
        () => Math.floor(deferredContainerHeight / 5),
        [deferredContainerHeight]
    )

    const virtualizer = useVirtualizer({
        count: TOTAL,
        getScrollElement: () => parentRef.current,
        estimateSize: () => itemSize,
        overscan: 10,
        gap: 1,
    })
    const items = virtualizer.getVirtualItems()

    const pointerSensor = useSensor(PointerSensor, {
        activationConstraint: {
            distance: 5,
        },
    })
    const sensors = useSensors(pointerSensor)

    useLayoutEffect(() => {
        const scrollElement = parentRef.current
        const prevItemSize = prevItemSizeRef.current
        prevItemSizeRef.current = itemSize

        if (!scrollElement || !prevItemSize || prevItemSize === itemSize) {
            virtualizer.measure()
            return
        }

        const prevRowSize = prevItemSize + 1
        const nextRowSize = itemSize + 1
        const anchorIndex = scrollElement.scrollTop / prevRowSize

        virtualizer.measure()
        scrollElement.scrollTop = anchorIndex * nextRowSize
    }, [itemSize, parentRef, virtualizer])

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
    }, [calendarTz, weekStartsOn])

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
    }, [calendarTz, targetDate, weekStartsOn])

    const updateMonthFromIndex = useCallback(
        (index: number) => {
            const weekOffset = index - CENTER_INDEX
            const date = getWeekOffset(
                baseDateRef.current,
                weekOffset,
                calendarTz,
                weekStartsOn
            )
            const monthKey = getMonthKey(date, calendarTz)

            if (prevMonthRef.current === monthKey) {
                return
            }

            prevMonthRef.current = monthKey
            startTransition(() => {
                setCurrentMonthKey(monthKey)
            })
            onVisibleMonthChange?.(
                dayjs.tz(date, calendarTz).startOf("month").toDate()
            )
        },
        [calendarTz, onVisibleMonthChange, weekStartsOn]
    )

    // 현재 월 계산 (스크롤 중 즉시 반영)
    useEffect(() => {
        if (!items.length) return
        const middle = items[Math.floor(items.length / 2)]
        if (!middle) return
        updateMonthFromIndex(middle.index)
    }, [items, updateMonthFromIndex])

    useEffect(() => {
        setRangeAnchorMonthKey((prev) => {
            const currentMonth = dayjs.tz(`${currentMonthKey}-01`, calendarTz)
            const anchorMonth = dayjs.tz(`${prev}-01`, calendarTz)

            if (!currentMonth.isValid() || !anchorMonth.isValid()) {
                return currentMonthKey
            }

            const lowerBound = anchorMonth.startOf("month")
            const upperBound = anchorMonth.add(1, "month").startOf("month")

            if (
                currentMonth.isBefore(lowerBound, "month") ||
                currentMonth.isAfter(upperBound, "month")
            ) {
                return currentMonthKey
            }

            return prev
        })
    }, [calendarTz, currentMonthKey])

    // 스크롤 끝나면 스냅
    useEffect(() => {
        const el = parentRef.current
        if (!el) return

        const clearSnapTimeout = () => {
            if (!snapTimeoutRef.current) return
            clearTimeout(snapTimeoutRef.current)
            snapTimeoutRef.current = null
        }

        const snapToClosestRow = () => {
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

            if (minDiff <= 1) {
                return
            }

            virtualizer.scrollToIndex(closest.index, {
                align: "start",
                behavior: "smooth",
            })
        }

        const handleScroll = () => {
            // 스크롤 중 즉시 반영: 가상 아이템 갱신 타이밍을 기다리지 않고
            // 현재 스크롤 위치로 중앙 주차 인덱스를 계산한다.
            const rowSize = itemSize + 1
            const centerScrollTop = el.scrollTop + el.clientHeight / 2
            const centerIndex = Math.max(
                0,
                Math.min(TOTAL - 1, Math.round(centerScrollTop / rowSize))
            )
            updateMonthFromIndex(centerIndex)

            clearSnapTimeout()
            snapTimeoutRef.current = setTimeout(snapToClosestRow, 80)
        }

        el.addEventListener("scroll", handleScroll)

        return () => {
            el.removeEventListener("scroll", handleScroll)
            clearSnapTimeout()
        }
    }, [itemSize, parentRef, updateMonthFromIndex, virtualizer])

    const visibleWeekMetas = useMemo<VisibleWeekMeta[]>(() => {
        return items
            .map((item) => {
                const weekOffset = item.index - CENTER_INDEX
                const weekDate = getWeekOffset(
                    baseDateRef.current,
                    weekOffset,
                    calendarTz,
                    weekStartsOn
                )
                const week = getWeek(weekDate, calendarTz, weekStartsOn)
                const visibleWeek = filterCalendarWeekVisibleDays(
                    week,
                    hideWeekendColumns
                )
                const firstDay = visibleWeek[0]
                const lastDay = visibleWeek[visibleWeek.length - 1]

                if (!firstDay || !lastDay) {
                    return null
                }

                return {
                    item,
                    visibleWeek,
                    weekStart: dayjs(firstDay)
                        .tz(calendarTz)
                        .startOf("day")
                        .valueOf(),
                    weekEndExclusive: dayjs(lastDay)
                        .tz(calendarTz)
                        .startOf("day")
                        .add(1, "day")
                        .valueOf(),
                }
            })
            .filter((meta): meta is VisibleWeekMeta => meta !== null)
    }, [calendarTz, hideWeekendColumns, items, weekStartsOn])

    const visibleRange = useMemo(() => {
        const currentMonth = dayjs
            .tz(`${rangeAnchorMonthKey}-01`, calendarTz)
            .valueOf()
        if (Number.isNaN(currentMonth)) {
            return null
        }

        return getCalendarVisibleEventRange(currentMonth, calendarTz)
    }, [calendarTz, rangeAnchorMonthKey])

    const filteredEvents = useMemo(() => {
        if (
            eventFilters.excludedStatuses.length === 0 &&
            eventFilters.excludedCollectionIds.length === 0 &&
            !eventFilters.excludedWithoutCollection
        ) {
            return events
        }

        const excludedStatuses = new Set(eventFilters.excludedStatuses)
        const excludedCollectionIds = new Set(
            eventFilters.excludedCollectionIds
        )

        return events.filter((event) => {
            if (excludedStatuses.has(event.status)) {
                return false
            }

            if (event.collectionIds.length === 0) {
                return !eventFilters.excludedWithoutCollection
            }

            if (excludedCollectionIds.size === 0) {
                return true
            }

            return event.collectionIds.some(
                (collectionId) => !excludedCollectionIds.has(collectionId)
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
    const mergedExpandedEvents = useMemo(() => {
        const merged = [...expandedEvents, ...subscriptionEvents]
        const seen = new Set<string>()
        const deduped: CalendarEvent[] = []

        for (const ev of merged) {
            const rid = getCalendarEventRenderId(ev)
            if (seen.has(rid)) {
                continue
            }

            seen.add(rid)
            deduped.push(ev)
        }

        return deduped
    }, [expandedEvents, subscriptionEvents])
    const { dragMode, dragStart, dragEnd, dragRenderId, draggingEvent } =
        useCalendarStore(
            (s) => ({
                dragMode: s.drag.mode,
                dragStart: s.drag.start,
                dragEnd: s.drag.end,
                dragRenderId: s.drag.renderId,
                draggingEvent: s.drag.previewEvent,
            }),
            shallow
        )
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
        for (const meta of visibleWeekMetas) {
            buckets.set(meta.item.index, [])
        }

        for (const event of positionedEvents) {
            for (const meta of visibleWeekMetas) {
                if (
                    event.endCalExclusive <= meta.weekStart ||
                    event.startCal >= meta.weekEndExclusive
                ) {
                    continue
                }

                buckets.get(meta.item.index)?.push(event)
            }
        }

        return buckets
    }, [positionedEvents, visibleWeekMetas])

    const handleDragPointerMove = useCallback(
        (event: PointerEvent) => {
            if (useCalendarStore.getState().drag.mode !== "move") {
                return
            }

            if (dragFrameRef.current !== null) {
                return
            }

            dragFrameRef.current = requestAnimationFrame(() => {
                dragFrameRef.current = null

                const cell = document
                    .elementsFromPoint(event.clientX, event.clientY)
                    .find((node) =>
                        (node as HTMLElement).closest?.("[data-date]")
                    )
                    ?.closest("[data-date]") as HTMLElement | undefined
                const overId = cell?.dataset.date

                if (!overId || lastOverIdRef.current === overId) {
                    return
                }

                lastOverIdRef.current = overId

                useCalendarStore
                    .getState()
                    .moveDrag(
                        dayjs.tz(overId, calendarTz).startOf("day").valueOf()
                    )
            })
        },
        [calendarTz]
    )

    const handleDragStart = useCallback(() => {
        if (isMobile) {
            return
        }
        dragCursorReleaseRef.current?.()
        dragCursorReleaseRef.current = lockCalendarBodyCursor(
            "month-list-move",
            "grabbing"
        )
        window.addEventListener("pointermove", handleDragPointerMove)
    }, [handleDragPointerMove, isMobile])

    const finishDragSession = useCallback(() => {
        lastOverIdRef.current = null

        if (dragFrameRef.current) {
            cancelAnimationFrame(dragFrameRef.current)
            dragFrameRef.current = null
        }
        dragCursorReleaseRef.current?.()
        dragCursorReleaseRef.current = null
        window.removeEventListener("pointermove", handleDragPointerMove)

        useCalendarStore.getState().endDrag()
    }, [handleDragPointerMove])

    useEffect(() => {
        if (!isMobile) {
            return
        }

        finishDragSession()
    }, [finishDragSession, isMobile])

    useEffect(() => {
        return () => {
            if (dragFrameRef.current) {
                cancelAnimationFrame(dragFrameRef.current)
            }
            if (snapTimeoutRef.current) {
                clearTimeout(snapTimeoutRef.current)
                snapTimeoutRef.current = null
            }
            dragCursorReleaseRef.current?.()
            dragCursorReleaseRef.current = null
            window.removeEventListener("pointermove", handleDragPointerMove)
        }
    }, [handleDragPointerMove])

    return (
        <DndContext
            sensors={sensors}
            autoScroll={{
                threshold: {
                    x: 0, // x축 임계값을 0으로 설정하여 감지 범위를 없애거나
                    y: 0.2, // y축만 활성화
                },
            }}
            onDragStart={handleDragStart}
            onDragEnd={finishDragSession}
            onDragCancel={finishDragSession}
        >
            <div
                style={{
                    height: virtualizer.getTotalSize(),
                    position: "relative",
                }}
            >
                {visibleWeekMetas.map((meta) => (
                    <WeekRow
                        key={meta.item.key}
                        isMobile={isMobile}
                        events={
                            positionedEventsByWeek.get(meta.item.index) ??
                            EMPTY_POSITIONED_WEEK_EVENTS
                        }
                        start={meta.item.start}
                        size={meta.item.size}
                        visibleWeek={meta.visibleWeek}
                        calendarTz={calendarTz}
                        currentMonthKey={currentMonthKey}
                    />
                ))}
            </div>
            <DragOverlay
                dropAnimation={null}
                style={{ pointerEvents: "none", willChange: "transform" }}
            >
                {!isMobile ? (
                    <CalendarDragOverlay calendarTz={calendarTz} />
                ) : null}
            </DragOverlay>
        </DndContext>
    )
}

const CalendarDragOverlay = memo(function CalendarDragOverlay({
    calendarTz,
}: {
    calendarTz: string
}) {
    const {
        dragEventId,
        dragMode,
        dragStart,
        dragEnd,
        dragSegmentOffset,
        draggingEvent,
        weekStartsOn,
        hideWeekendColumns,
    } = useCalendarStore((s) => {
        const layout = normalizeCalendarLayoutOptions(
            s.activeCalendar?.layoutOptions
        )
        return {
            dragEventId: s.drag.eventId,
            dragMode: s.drag.mode,
            dragStart: s.drag.start,
            dragEnd: s.drag.end,
            dragSegmentOffset: s.drag.segmentOffset,
            draggingEvent: s.drag.previewEvent,
            weekStartsOn: layout.weekStartsOn,
            hideWeekendColumns: layout.hideWeekendColumns,
        }
    }, shallow)

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
    const overlayWeek = getWeek(
        segmentStartDay.toDate(),
        calendarTz,
        weekStartsOn
    )
    const visibleOverlayWeek = filterCalendarWeekVisibleDays(
        overlayWeek,
        hideWeekendColumns
    )
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
            isMobile={false}
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
