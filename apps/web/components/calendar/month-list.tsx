import dayjs from "@/lib/dayjs"
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
import { useEffect, useRef, useState } from "react"
import { EventItem } from "./event-item"
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
    const newDate = dayjs().startOf("isoWeek").toDate()
    const draggingEvent = useCalendarStore((s) => s.draggingEvent)
    const updateEvent = useCalendarStore((s) => s.updateEvent)
    const setDraggingEvent = useCalendarStore((s) => s.setDraggingEvent)
    const draggingOverDate = useCalendarStore((s) => s.draggingOverDate)
    const setDraggingOverDate = useCalendarStore((s) => s.setDraggingOverDate)
    const setDragging = useCalendarStore((s) => s.setDraggingEventId)
    const baseDateRef = useRef(newDate)
    const prevMonthRef = useRef<string | null>(null)
    const [currentMonthKey, setCurrentMonthKey] = useState(getMonthKey(newDate))

    const overlayWeek = draggingOverDate
        ? getWeek(dayjs(draggingOverDate).toDate())
        : []

    const virtualizer = useVirtualizer({
        count: TOTAL,
        getScrollElement: () => parentRef.current,
        estimateSize: () => Math.floor(containerHeight / 5),
        overscan: 10,
        gap: 1,
    })

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                delay: 50, // 👈 클릭 방지 핵심
                tolerance: 5,
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

        const diff = Math.floor(
            (firstWeekStart.toDate().getTime() - base.getTime()) /
                (1000 * 60 * 60 * 24 * 7)
        )

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
        const date = getWeekOffset(baseDateRef.current, weekOffset)

        const monthKey = getMonthKey(date)
        if (prevMonthRef.current === monthKey) return

        prevMonthRef.current = monthKey

        setCurrentMonthKey(monthKey)
        onVisibleMonthChange?.(dayjs(date).startOf("month").toDate())

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
            onDragOver={({ over }) => {
                if (!over) return
                const id = over.id as string
                setDragging(id)

                const event = useCalendarStore
                    .getState()
                    .events.find((e) => e.id === id)
                setDraggingOverDate(over.id as string)

                if (!event) return
                setDraggingEvent(event)
            }}
            onDragStart={({ active }) => {
                const id = active.id as string
                console.log(active.id)

                const event = useCalendarStore
                    .getState()
                    .events.find((e) => e.id === id)

                if (!event) return

                setDraggingEvent(event)
            }}
            onDragEnd={({ active, over }) => {
                if (!over) return
                setDragging(undefined)
                setDraggingEvent(undefined)
                setDraggingOverDate(undefined)

                const id = active.id as string
                const newDate = over.id as string

                const event = useCalendarStore
                    .getState()
                    .events.find((e) => e.id === id)

                if (!event) return

                const duration = dayjs(event.end).diff(event.start, "minute")

                updateEvent(id, {
                    start: dayjs(newDate).toISOString(),
                    end: dayjs(newDate).add(duration, "minute").toISOString(),
                })
            }}
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
                        weekOffset
                    )

                    return (
                        <WeekRow
                            key={item.key}
                            start={item.start}
                            size={item.size}
                            weekDate={weekDate}
                            currentMonthKey={currentMonthKey}
                        />
                    )
                })}
            </div>
            <DragOverlay dropAnimation={null}>
                {draggingEvent ? (
                    <EventItem
                        event={draggingEvent}
                        week={overlayWeek}
                        top={0}
                        overlay
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    )
}
