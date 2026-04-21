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
import {
    memo,
    useCallback,
    useEffect,
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
    const eventFilters = useCalendarStore((s) => s.eventFilters, shallow)
    const newDate = dayjs().tz(calendarTz).startOf("isoWeek").toDate()
    const baseDateRef = useRef(newDate)
    const prevMonthRef = useRef<string | null>(null)
    const dragFrameRef = useRef<number | null>(null)
    const lastOverIdRef = useRef<string | null>(null)
    const [currentMonthKey, setCurrentMonthKey] = useState(
        getMonthKey(newDate, calendarTz)
    )

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

        // 👇 핵심: 해당 달의 1일
        const firstDayOfMonth = dayjs(newDate).startOf("month")

        // 👇 그 1일이 포함된 주 시작
        const firstWeekStart = firstDayOfMonth.startOf("isoWeek")

        const diff = dayjs(firstWeekStart)
            .tz(calendarTz)
            .diff(dayjs(base).tz(calendarTz), "week")

        virtualizer.scrollToIndex(CENTER_INDEX + diff, {
            align: "start",
        })

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // 외부 이동
    useEffect(() => {
        if (!targetDate) return

        const base = baseDateRef.current

        const firstDayOfMonth = dayjs(targetDate).startOf("month")
        const firstWeekStart = firstDayOfMonth.startOf("isoWeek")

        const diff = Math.floor(
            (firstWeekStart.toDate().getTime() - base.getTime()) /
                (1000 * 60 * 60 * 24 * 7)
        )

        virtualizer.scrollToIndex(CENTER_INDEX + diff, {
            align: "start",
        })

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetDate])

    // 현재 월 계산
    useEffect(() => {
        const items = virtualizer.getVirtualItems()
        if (!items.length) return

        const middle = items[Math.floor(items.length / 2)]
        if (!middle) return

        const weekOffset = middle.index - CENTER_INDEX
        const date = getWeekOffset(baseDateRef.current, weekOffset, calendarTz)

        const monthKey = getMonthKey(date, calendarTz)
        if (prevMonthRef.current === monthKey) return

        prevMonthRef.current = monthKey

        setCurrentMonthKey(monthKey)
        onVisibleMonthChange?.(
            dayjs.tz(date, calendarTz).startOf("month").toDate()
        )

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [virtualizer.getVirtualItems()])

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
                setTimeout(() => {
                    isSnapping = false
                }, 300)
            }, 250)
        }

        el.addEventListener("scroll", handleScroll)

        return () => {
            el.removeEventListener("scroll", handleScroll)
            if (timeout) clearTimeout(timeout)
        }
    }, [virtualizer, parentRef])
    const items = virtualizer.getVirtualItems()

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
    const positionedEvents = useMemo(
        () => positionCalendarEvents(filteredEvents, calendarTz),
        [calendarTz, filteredEvents]
    )

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

    const finishDragSession = useCallback(() => {
        lastOverIdRef.current = null

        if (dragFrameRef.current) {
            cancelAnimationFrame(dragFrameRef.current)
            dragFrameRef.current = null
        }

        useCalendarStore.getState().endDrag()
    }, [])

    useEffect(() => {
        return () => {
            if (dragFrameRef.current) {
                cancelAnimationFrame(dragFrameRef.current)
            }
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
                        calendarTz
                    )

                    return (
                        <WeekRow
                            key={item.key}
                            events={positionedEvents}
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
    const draggingEvent = useCalendarStore((s) =>
        s.drag.eventId ? s.events.find((e) => e.id === s.drag.eventId) : null
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

    const overlayWeek = getWeek(dayjs.tz(dragStart, calendarTz).toDate(), calendarTz)
    const overlayWeekStart = dayjs(overlayWeek[0]!).tz(calendarTz).startOf("day")
    const { startDay, endDay } = toCalendarRange(
        {
            ...draggingEvent,
            start: dragStart,
            end: dragEnd,
        },
        calendarTz
    )
    const startIndex = Math.max(0, startDay.diff(overlayWeekStart, "day"))
    const endIndex = Math.min(6, endDay.diff(overlayWeekStart, "day"))
    const continuesFromPrevWeek = startDay.isBefore(overlayWeekStart, "day")
    const continuesToNextWeek = endDay.isAfter(
        overlayWeekStart.add(6, "day"),
        "day"
    )

    return (
        <EventItem
            event={draggingEvent}
            top={0}
            startIndex={startIndex}
            endIndex={endIndex}
            continuesFromPrevWeek={continuesFromPrevWeek}
            continuesToNextWeek={continuesToNextWeek}
            overlay
        />
    )
})

export type { PositionedCalendarEvent }
