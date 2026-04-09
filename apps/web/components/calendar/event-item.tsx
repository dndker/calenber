import { toCalendarRange } from "@/lib/date"
import dayjs from "@/lib/dayjs"
import { CalendarEvent, useCalendarStore } from "@/store/useCalendarStore"
import { useDraggable } from "@dnd-kit/core"
import { Button } from "@workspace/ui/components/button"
import clsx from "clsx"
import { memo, useRef } from "react"

export function getEventPosition(
    event: CalendarEvent,
    week: Date[],
    calendarTz: string
) {
    const { startDay, endDay } = toCalendarRange(event, calendarTz)

    const weekStart = dayjs(week[0]).tz(calendarTz).startOf("day")

    const startIndex = startDay.diff(weekStart, "day")
    const endIndex = endDay.diff(weekStart, "day")

    const span = endIndex - startIndex + 1

    const GAP = 4

    return {
        left: `calc(${(startIndex / 7) * 100}% + ${GAP}px)`,
        width: `calc(${(span / 7) * 100}% - ${GAP * 2}px)`,
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
    const calendarTz = useCalendarStore((s) => s.calendarTimezone)
    const rectRef = useRef<DOMRect | null>(null)
    const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
        id: event.id,
    })

    const pos = !overlay ? getEventPosition(event, week, calendarTz) : null

    const mergedListeners = {
        ...listeners,
        onPointerDown: (e: React.PointerEvent) => {
            if (!rectRef.current) {
                rectRef.current = e.currentTarget.getBoundingClientRect()
            }
            const rect = rectRef.current
            if (!rect) return

            const offsetX = e.clientX - rect.left

            const { startDay, endDay } = toCalendarRange(event, calendarTz)
            const totalDays = endDay.diff(startDay, "day") + 1

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
