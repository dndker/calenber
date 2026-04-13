import { toCalendarRange } from "@/lib/date"
import dayjs from "@/lib/dayjs"
import { CalendarEvent, useCalendarStore } from "@/store/useCalendarStore"
import { useDraggable } from "@dnd-kit/core"
import { Button } from "@workspace/ui/components/button"
import clsx from "clsx"
import { useRouter } from "next/navigation"
import { memo, useEffect, useRef } from "react"

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

export const EventItem = memo(
    function EventItem({
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
        const router = useRouter()

        const calendarTz = useCalendarStore((s) => s.calendarTimezone)
        const startDrag = useCalendarStore((s) => s.startDrag)
        const dragIndexRef = useRef(0)
        const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
            id: event.id,
        })

        const pos = !overlay ? getEventPosition(event, week, calendarTz) : null

        const { startDay, endDay } = toCalendarRange(event, calendarTz)

        const handleMoveStart = (e: React.PointerEvent) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const offsetX = e.clientX - rect.left

            const totalDays = endDay.diff(startDay, "day") + 1
            const dayWidth = rect.width / totalDays

            const index = Math.floor(offsetX / dayWidth)
            // const clickedDate = startDay.add(index, "day").valueOf()
            dragIndexRef.current = index

            // startDrag(event, "move", index)

            // 🔥 이거 없으면 dnd 작동안함
            listeners?.onPointerDown?.(e)
        }

        const handleResizeStart = (e: React.PointerEvent) => {
            startDrag(event, "resize-start", event.start)
            listeners?.onPointerDown?.(e)
        }

        const handleResizeEnd = (e: React.PointerEvent) => {
            startDrag(event, "resize-end", event.end)
            listeners?.onPointerDown?.(e)
        }

        useEffect(() => {
            if (!isDragging) return

            startDrag(event, "move", dragIndexRef.current)

            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [isDragging])

        const mergedListeners = {
            ...listeners,
            onPointerDown: handleMoveStart,
        }

        return (
            <div
                ref={setNodeRef}
                {...mergedListeners}
                {...attributes}
                className={clsx("absolute will-change-transform select-none", {
                    "event-drag-row opacity-50": isDragging,
                    "cursor-grab active:cursor-grabbing": overlay,
                })}
                style={{
                    ...pos,
                    width: overlay ? "100%" : pos?.width,
                    top: `${top * 32}px`, // 🔥 stacking
                    zIndex: isDragging ? 100 : 1,
                    // background: event.color,
                }}
            >
                <div
                    onPointerDown={handleResizeStart}
                    className="pointer-events-all absolute top-0 left-0 z-1 h-full w-1 cursor-ew-resize bg-transparent"
                />

                <Button
                    variant="outline"
                    size="sm"
                    className={clsx(
                        "pointer-events-all w-full justify-start rounded px-1 transition-none will-change-transform dark:bg-[#151515] dark:hover:bg-[#1c1c1c]"
                    )}
                    onClick={() => {
                        router.push(`/calendar?e=${event.id}`)
                    }}
                >
                    {event.title === "" ? "새 일정" : event.title}
                </Button>

                <div
                    onPointerDown={handleResizeEnd}
                    className="pointer-events-all absolute top-0 right-0 z-100 h-full w-1 bg-transparent hover:cursor-ew-resize"
                />
            </div>
        )
    },
    (prev, next) => {
        return (
            prev.event.id === next.event.id &&
            prev.event.start === next.event.start &&
            prev.event.end === next.event.end &&
            prev.event.title === next.event.title &&
            prev.event.color === next.event.color &&
            prev.top === next.top &&
            prev.overlay === next.overlay
        )
    }
)
