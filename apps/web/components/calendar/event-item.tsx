import dayjs from "@/lib/dayjs"
import { CalendarEvent, useCalendarStore } from "@/store/useCalendarStore"
import { useDraggable } from "@dnd-kit/core"
import { Button } from "@workspace/ui/components/button"
import clsx from "clsx"
import { memo } from "react"

const DAY = 1000 * 60 * 60 * 24

export function getEventPosition(event: CalendarEvent, week: Date[]) {
    const tz = event.timezone

    const start = dayjs(event.start).tz(tz).startOf("day").valueOf()
    const end = dayjs(event.end).tz(tz).endOf("day").valueOf()

    const weekStart = dayjs(week[0]).startOf("day").valueOf()
    const weekEnd = dayjs(week[6]).endOf("day").valueOf()

    const effectiveStart = Math.max(start, weekStart)
    const effectiveEnd = Math.min(end, weekEnd)

    const startIndex = Math.floor((effectiveStart - weekStart) / DAY)
    const endIndex = Math.floor((effectiveEnd - weekStart) / DAY)

    const span = endIndex - startIndex + 1

    const isStartInThisWeek = start >= weekStart
    const isEndInThisWeek = end <= weekEnd

    const GAP = 4

    const baseLeft = (startIndex / 7) * 100
    const baseWidth = (span / 7) * 100

    const leftGap = isStartInThisWeek ? GAP : 0
    const rightGap = isEndInThisWeek ? GAP : 0

    return {
        left: `calc(${baseLeft}% + ${leftGap}px)`,
        width: `calc(${baseWidth}% - ${leftGap + rightGap}px)`,
    }
}

export const EventItem = memo(function EventItem({
    event,
    week,
    top,
    overlay = false,
}: {
    event: CalendarEvent
    week: Date[]
    top: number
    overlay?: boolean
}) {
    const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
        id: event.id,
    })

    const pos = !overlay ? getEventPosition(event, week) : null

    const mergedListeners = {
        ...listeners,
        onPointerDown: (e: React.PointerEvent) => {
            const rect = e.currentTarget.getBoundingClientRect()
            if (!rect) return

            const offsetX = e.clientX - rect.left

            const totalDays =
                dayjs(event.end).diff(dayjs(event.start), "day") + 1

            const dayWidth = rect.width / totalDays

            const index = Math.floor(offsetX / dayWidth)

            useCalendarStore.getState().setDragOffset(index)

            listeners?.onPointerDown?.(e)
        },
    }

    return (
        <Button
            variant="outline"
            size="sm"
            ref={setNodeRef}
            {...mergedListeners}
            {...attributes}
            className={clsx(
                "pointer-events-all absolute justify-start rounded px-1 transition-none will-change-transform dark:bg-[#151515] dark:hover:bg-[#1c1c1c]",
                {
                    "event-drag-row opacity-50": isDragging,
                    "cursor-grab active:cursor-grabbing": overlay,
                }
            )}
            style={{
                ...pos,
                width: overlay ? "100%" : pos?.width,
                top: `${top * 32}px`, // 🔥 stacking
                zIndex: isDragging ? 100 : 1,
                // background: event.color,
            }}
        >
            {event.title}
        </Button>
    )
})
