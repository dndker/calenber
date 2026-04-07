import { useNow } from "@/hooks/use-now"
import dayjs from "@/lib/dayjs"
import { useCalendarStore } from "@/store/useCalendarStore"
import { useDroppable } from "@dnd-kit/core"
import { cn } from "@workspace/ui/lib/utils"
import clsx from "clsx"
import { memo, useCallback, useRef } from "react"

export const DayCell = memo(
    ({ day, isCurrentMonth }: { day: Date; isCurrentMonth: boolean }) => {
        const { setNodeRef } = useDroppable({
            id: dayjs(day).format("YYYY-MM-DD"),
        })

        const now = useNow()

        const dayValue = dayjs(day).startOf("day").valueOf()
        const draggingId = useCalendarStore((s) => s.draggingEventId)

        const isSelected = useCalendarStore((s) => s.selectedDate === dayValue)
        const setSelectedDate = useCalendarStore((s) => s.setSelectedDate)
        const setViewportMiniDate = useCalendarStore(
            (s) => s.setViewportMiniDate
        )
        const setRange = useCalendarStore((s) => s.setRange)
        const selectedRange = useCalendarStore((s) => s.selectedRange)

        const isDragging = useRef(false)

        const startRange = (date: Date) => {
            isDragging.current = true
            setRange({ start: date, end: date })
        }

        const updateRange = (date: Date) => {
            if (!isDragging.current || !selectedRange) return

            setRange({
                start: selectedRange.start,
                end: date,
            })
        }

        const endRange = () => {
            isDragging.current = false
        }

        const handleClick = useCallback(() => {
            setSelectedDate(day)
            setViewportMiniDate(day)
        }, [day, setSelectedDate, setViewportMiniDate])

        const isHoverTarget = draggingId === dayjs(day).format("YYYY-MM-DD")

        return (
            <div
                ref={setNodeRef}
                onPointerDown={() => startRange(day)}
                onPointerEnter={() => updateRange(day)}
                onPointerUp={endRange}
                onClick={handleClick}
                className={cn(
                    "flex flex-col p-3 text-sm font-medium select-none",
                    isCurrentMonth
                        ? "bg-background text-foreground"
                        : "bg-background/50 text-muted-foreground/60",
                    isHoverTarget && "bg-muted/10"
                )}
            >
                <div className="flex items-center *:inline-flex *:size-8 *:items-center *:justify-center *:rounded-lg">
                    {day.getDate() === 1 && (
                        <span className="text-sm font-medium text-muted-foreground/80">
                            {dayjs(day).format("M월")}
                        </span>
                    )}

                    <span
                        className={clsx("ml-auto", {
                            "bg-primary text-primary-foreground": isSelected,
                            "bg-muted": dayjs(now).isSame(day, "day"),
                        })}
                    >
                        {day.getDate()}
                    </span>
                </div>
            </div>
        )
    }
)

DayCell.displayName = "DayCell"
