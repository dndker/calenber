import dayjs from "@/lib/dayjs"
import { CalendarEvent, useCalendarStore } from "@/store/useCalendarStore"
import { useDraggable } from "@dnd-kit/core"
import { Button } from "@workspace/ui/components/button"
import clsx from "clsx"
import { memo } from "react"

export function getEventPosition(event: CalendarEvent, week: Date[]) {
    const start = dayjs(event.start)
    const end = dayjs(event.end)

    const weekStart = dayjs(week[0]).startOf("day")
    const weekEnd = dayjs(week[6]).endOf("day")

    // ✅ 주 기준으로 clamp
    const effectiveStart = start.isBefore(weekStart) ? weekStart : start
    const effectiveEnd = end.isAfter(weekEnd) ? weekEnd : end

    // ✅ index 안전하게 계산
    const startIndex = effectiveStart.diff(weekStart, "day")
    const endIndex = effectiveEnd.diff(weekStart, "day")

    const span = endIndex - startIndex + 1

    // ✅ 주 기준 시작/끝 여부
    const isStartInThisWeek = start.isSameOrAfter(weekStart)
    const isEndInThisWeek = end.isSameOrBefore(weekEnd)

    const GAP = 4 // px

    const baseLeft = (startIndex / 7) * 100
    const baseWidth = (span / 7) * 100

    const leftGap = isStartInThisWeek ? GAP : 0
    const rightGap = isEndInThisWeek ? GAP : 0

    return {
        left: `calc(${baseLeft}% + ${leftGap}px)`,
        width: `calc(${baseWidth}% - ${leftGap + rightGap}px)`,

        // 🔥 border radius 핵심
        borderTopLeftRadius: isStartInThisWeek ? 6 : 0,
        borderBottomLeftRadius: isStartInThisWeek ? 6 : 0,
        borderLeftWidth: isStartInThisWeek ? 1 : 0,
        borderTopRightRadius: isEndInThisWeek ? 6 : 0,
        borderBottomRightRadius: isEndInThisWeek ? 6 : 0,
        borderRightWidth: isEndInThisWeek ? 1 : 0,
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
