"use client"

import dayjs from "@/lib/dayjs"
import { Spinner } from "@workspace/ui/components/spinner"
import { useCalendarStore } from "@/store/useCalendarStore"
import { useCallback, useLayoutEffect, useRef, useState } from "react"
import { MonthHeader } from "./month-header"
import { MonthList } from "./month-list"
import { MonthSkeleton } from "./month-skeleton"

export default function Calendar() {
    const parentRef = useRef<HTMLDivElement>(null)
    const [containerHeight, setContainerHeight] = useState(0)
    const selectedDate = useCalendarStore((s) => s.selectedDate)
    const setViewportDate = useCalendarStore((s) => s.setViewportDate)
    const setViewportMiniDate = useCalendarStore((s) => s.setViewportMiniDate)
    const isCalendarLoading = containerHeight <= 0

    const onVisibleMonthChange = useCallback(
        (date: Date) => {
            setViewportDate(date)
            setViewportMiniDate(date)
        },
        [setViewportDate, setViewportMiniDate]
    )

    useLayoutEffect(() => {
        if (!parentRef.current) return

        const update = () => {
            const h = parentRef.current!.clientHeight
            if (h > 0) {
                setContainerHeight(h)
            }
        }

        update()

        const ro = new ResizeObserver(update)
        ro.observe(parentRef.current)

        return () => ro.disconnect()
    }, [])

    return (
        <div className="relative flex h-full flex-col overflow-hidden bg-border/70">
            {isCalendarLoading && (
                <div className="absolute top-0 left-0 z-20 flex h-full w-full items-start justify-start bg-muted/45 px-4 py-3">
                    <div className="-ml-1 flex size-7 items-center justify-center">
                        <Spinner className="size-4.5" />
                    </div>
                </div>
            )}

            <MonthHeader />
            <div
                ref={parentRef}
                className="scrollbar-hide max-w-full flex-1 overflow-x-hidden overflow-y-auto"
            >
                {!isCalendarLoading ? (
                    <MonthList
                        key={containerHeight}
                        parentRef={parentRef}
                        containerHeight={containerHeight}
                        targetDate={dayjs(selectedDate)
                            .startOf("month")
                            .toDate()}
                        onVisibleMonthChange={onVisibleMonthChange}
                    />
                ) : (
                    <MonthSkeleton />
                )}
            </div>
        </div>
    )
}
