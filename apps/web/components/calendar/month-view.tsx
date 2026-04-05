"use client"

import { useCalendarStore } from "@/store/useCalendarStore"
import dayjs from "dayjs"
import { useCallback, useEffect, useRef, useState } from "react"
import { MonthHeader } from "./month-header"
import { MonthList } from "./month-list"

export default function Calendar({ targetDate }: { targetDate?: Date }) {
    const parentRef = useRef<HTMLDivElement>(null)
    const [containerHeight, setContainerHeight] = useState(0)
    const selectedDate = useCalendarStore((s) => s.selectedDate)
    const setViewportDate = useCalendarStore((s) => s.setViewportDate)

    const onVisibleMonthChange = useCallback(
        (date: Date) => {
            setViewportDate(date)
        },
        [setViewportDate]
    )

    useEffect(() => {
        if (!parentRef.current) return
        console.log(parentRef.current)

        const update = () => {
            const h = parentRef.current!.clientHeight
            if (h > 0) setContainerHeight(h)
        }

        update()

        const ro = new ResizeObserver(update)
        ro.observe(parentRef.current)

        return () => ro.disconnect()
    }, [])

    return (
        <div className="flex h-full flex-col overflow-hidden bg-border/65">
            <MonthHeader />

            <div
                ref={parentRef}
                className="scrollbar-hide flex-1 snap-y snap-proximity overflow-auto"
            >
                {containerHeight > 0 && (
                    <MonthList
                        key={containerHeight}
                        parentRef={parentRef}
                        containerHeight={containerHeight}
                        targetDate={dayjs(selectedDate)
                            .startOf("month")
                            .toDate()}
                        onVisibleMonthChange={onVisibleMonthChange}
                    />
                )}
            </div>
        </div>
    )
}
