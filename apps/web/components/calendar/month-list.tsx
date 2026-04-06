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
