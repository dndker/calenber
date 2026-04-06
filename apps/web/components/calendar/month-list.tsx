import {
    CENTER_INDEX,
    TOTAL,
    getMonthKey,
    getWeekOffset,
} from "@/utils/calendar"
import { useVirtualizer } from "@tanstack/react-virtual"
import dayjs from "dayjs"
import { useEffect, useRef, useState } from "react"
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
    const baseDateRef = useRef(new Date())
    const prevMonthRef = useRef<string | null>(null)
    const [currentMonthKey, setCurrentMonthKey] = useState(
        getMonthKey(new Date())
    )

    const virtualizer = useVirtualizer({
        count: TOTAL,
        getScrollElement: () => parentRef.current,
        estimateSize: () => Math.floor(containerHeight / 5),
        overscan: 10,
        gap: 1,
    })

    // 초기 위치
    useEffect(() => {
        const today = new Date()

        const diff = Math.floor(
            (today.getTime() - baseDateRef.current.getTime()) /
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

        const diff = Math.floor(
            (targetDate.getTime() - baseDateRef.current.getTime()) /
                (1000 * 60 * 60 * 24 * 7)
        )

        virtualizer.scrollToIndex(CENTER_INDEX + diff, { align: "start" })
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

    const items = virtualizer.getVirtualItems()

    return (
        <div
            style={{
                height: virtualizer.getTotalSize(),
                position: "relative",
            }}
        >
            {items.map((item) => {
                const weekOffset = item.index - CENTER_INDEX
                const weekDate = getWeekOffset(baseDateRef.current, weekOffset)

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
    )
}
