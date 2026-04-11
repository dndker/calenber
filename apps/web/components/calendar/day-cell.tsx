import { useNow } from "@/hooks/use-now"
import { toCalendarDay } from "@/lib/date"
import dayjs from "@/lib/dayjs"
import { useCalendarStore } from "@/store/useCalendarStore"
import { useDroppable } from "@dnd-kit/core"
import { cn } from "@workspace/ui/lib/utils"
import clsx from "clsx"
import { memo, useCallback, useMemo, useRef } from "react"

export const DayCell = memo(
    ({ day, isCurrentMonth }: { day: Date; isCurrentMonth: boolean }) => {
        const calendarTz = useCalendarStore((s) => s.calendarTimezone)
        const startSelection = useCalendarStore((s) => s.startSelection)
        const updateSelection = useCalendarStore((s) => s.updateSelection)
        const endSelection = useCalendarStore((s) => s.endSelection)
        const isSelecting = useCalendarStore((s) => s.selection.isSelecting)

        const isDraggingRef = useRef(false)
        const clickTimeout = useRef<NodeJS.Timeout | null>(null)

        const { setNodeRef } = useDroppable({
            id: dayjs(day).format("YYYY-MM-DD"),
        })

        const now = useNow(calendarTz)
        const dayValue = useMemo(() => {
            return toCalendarDay(day, calendarTz)
        }, [day, calendarTz])

        const isSelected = useCalendarStore((s) => s.selectedDate === dayValue)
        const setSelectedDate = useCalendarStore((s) => s.setSelectedDate)
        const setViewportMiniDate = useCalendarStore(
            (s) => s.setViewportMiniDate
        )

        const handleClick = useCallback(() => {
            if (isDraggingRef.current) return

            if (clickTimeout.current) {
                clearTimeout(clickTimeout.current)
            }
            clickTimeout.current = setTimeout(() => {
                setSelectedDate(day)
                setViewportMiniDate(day)
            }, 150)
        }, [day, setSelectedDate, setViewportMiniDate])

        const handleDoubleClick = () => {
            if (clickTimeout.current) {
                clearTimeout(clickTimeout.current)
            }
            console.log("이벤트 생성")
        }

        const isHover = useCalendarStore((s) => {
            if (!s.drag.eventId) return false
            return dayValue >= s.drag.start && dayValue <= s.drag.end
        })

        const handlePointerDown = (e: React.PointerEvent) => {
            // 🔥 이벤트 클릭이면 무시
            if ((e.target as HTMLElement).closest(".event-drag-row")) return
            isDraggingRef.current = false

            startSelection(dayValue)
        }

        const handlePointerEnter = () => {
            if (!isSelecting) return
            isDraggingRef.current = true
            updateSelection(dayValue)
        }

        const handlePointerUp = () => {
            if (!isSelecting) return
            endSelection()
        }

        const isSelectingRange = useCalendarStore((s) => {
            if (!s.selection.isSelecting) return false
            if (!s.selection.start || !s.selection.end) return false

            return dayValue >= s.selection.start && dayValue <= s.selection.end
        })

        return (
            <div
                data-date={dayjs(day).format("YYYY-MM-DD")}
                ref={setNodeRef}
                onPointerDown={handlePointerDown}
                onPointerEnter={handlePointerEnter}
                onPointerUp={handlePointerUp}
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                className={cn(
                    "flex flex-col p-3 text-sm font-medium select-none",
                    isCurrentMonth
                        ? "bg-background text-foreground"
                        : "bg-background/50 text-muted-foreground/60",
                    (isHover || isSelectingRange) &&
                        "drag-event bg-blue-50/99.5 dark:bg-blue-50/0.5"
                )}
            >
                <div className="flex items-center *:inline-flex *:size-8 *:items-center *:justify-center *:rounded-lg">
                    {day.getDate() === 1 && (
                        <span className="text-sm text-muted-foreground/80">
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
    },
    (prev, next) =>
        prev.day.getTime() === next.day.getTime() &&
        prev.isCurrentMonth === next.isCurrentMonth
)

DayCell.displayName = "DayCell"
