"use client"

import dayjs from "@/lib/dayjs"
import { useCalendarStore } from "@/store/useCalendarStore"
import { Spinner } from "@workspace/ui/components/spinner"
import { useCallback, useEffect, useRef, useState } from "react"
import { MonthHeader } from "./month-header"
import { MonthList } from "./month-list"
import { MonthSkeleton } from "./month-skeleton"

export default function Calendar({ targetDate }: { targetDate?: Date }) {
    const parentRef = useRef<HTMLDivElement>(null)
    const [containerHeight, setContainerHeight] = useState(0)
    const isCalendarLoading = useCalendarStore((s) => s.isCalendarLoading)
    const setIsCalendarLoading = useCalendarStore((s) => s.setIsCalendarLoading)
    const selectedDate = useCalendarStore((s) => s.selectedDate)
    const setViewportDate = useCalendarStore((s) => s.setViewportDate)
    const setViewportMiniDate = useCalendarStore((s) => s.setViewportMiniDate)

    const onVisibleMonthChange = useCallback(
        (date: Date) => {
            setViewportDate(date)
            setViewportMiniDate(date)
        },
        [setViewportDate, setViewportMiniDate]
    )

    useEffect(() => {
        setIsCalendarLoading(true)
        if (!parentRef.current) return

        const update = () => {
            const h = parentRef.current!.clientHeight
            if (h > 0) {
                setContainerHeight(h)
                setIsCalendarLoading(false)
            }
        }

        update()

        const ro = new ResizeObserver(update)
        ro.observe(parentRef.current)

        return () => ro.disconnect()
    }, [setIsCalendarLoading])

    return (
        <div className="relative flex h-full flex-col overflow-hidden bg-border/65">
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
