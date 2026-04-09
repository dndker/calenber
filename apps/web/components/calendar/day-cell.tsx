import { useNow } from "@/hooks/use-now"
import { eventToCalendar, toCalendarDay } from "@/lib/date"
import dayjs from "@/lib/dayjs"
import { useCalendarStore } from "@/store/useCalendarStore"
import { useDroppable } from "@dnd-kit/core"
import { cn } from "@workspace/ui/lib/utils"
import clsx from "clsx"
import { memo, useCallback, useMemo } from "react"

export const DayCell = memo(
    ({ day, isCurrentMonth }: { day: Date; isCurrentMonth: boolean }) => {
        const calendarTz = useCalendarStore((s) => s.calendarTimezone)

        const { setNodeRef } = useDroppable({
            id: dayjs(day).format("YYYY-MM-DD"),
        })

        const now = useNow(calendarTz)
        const dayValue = useMemo(() => {
            return toCalendarDay(day, calendarTz)
        }, [day, calendarTz])

        const draggingEvent = useCalendarStore((s) => s.draggingEvent)
        const draggingOverDate = useCalendarStore((s) => s.draggingOverDate)

        const isSelected = useCalendarStore((s) => s.selectedDate === dayValue)
        const setSelectedDate = useCalendarStore((s) => s.setSelectedDate)
        const setViewportMiniDate = useCalendarStore(
            (s) => s.setViewportMiniDate
        )

        const handleClick = useCallback(() => {
            setSelectedDate(day)
            setViewportMiniDate(day)
        }, [day, setSelectedDate, setViewportMiniDate])

        /** 🔥 핵심: hover range 정확 계산 */
        const isHoverTarget = useMemo(() => {
            if (!draggingEvent || !draggingOverDate) return false

            const start = toCalendarDay(draggingOverDate, calendarTz)

            let startDay: number
            let endDay: number

            if (draggingEvent.allDay) {
                startDay = dayjs(draggingEvent.start).startOf("day").valueOf()
                endDay = dayjs(draggingEvent.end).startOf("day").valueOf()
            } else {
                startDay = eventToCalendar(
                    draggingEvent,
                    draggingEvent.start,
                    calendarTz
                )
                    .startOf("day")
                    .valueOf()

                endDay = eventToCalendar(
                    draggingEvent,
                    draggingEvent.end,
                    calendarTz
                )
                    .startOf("day")
                    .valueOf()
            }

            const duration = dayjs(endDay).diff(dayjs(startDay), "day")
            const end = dayjs(start).add(duration, "day").valueOf()

            return dayValue >= start && dayValue <= end
        }, [draggingEvent, draggingOverDate, dayValue, calendarTz])

        return (
            <div
                ref={setNodeRef}
                onClick={handleClick}
                className={cn(
                    "flex flex-col p-3 text-sm font-medium select-none",
                    isCurrentMonth
                        ? "bg-background text-foreground"
                        : "bg-background/50 text-muted-foreground/60",
                    isHoverTarget &&
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
