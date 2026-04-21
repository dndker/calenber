import { useCalendarStore } from "@/store/useCalendarStore"
import { getMonthKey, getWeek } from "@/utils/calendar"
import clsx from "clsx"
import { memo } from "react"
import type { PositionedCalendarEvent } from "./event-positioning"
import { DayCell } from "./day-cell"
import { EventRow } from "./event-row"

export const WeekRow = memo(
    ({
        events,
        start,
        size = 200,
        weekDate,
        currentMonthKey,
        skeleton = false,
    }: {
        events: PositionedCalendarEvent[]
        start?: number
        skeleton?: boolean
        size?: number
        weekDate: Date
        currentMonthKey: string
    }) => {
        const calendarTimezone = useCalendarStore((s) => s.calendarTimezone)
        const week = getWeek(weekDate, calendarTimezone)

        return (
            <div
                style={
                    !skeleton
                        ? {
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              height: size,
                              transform: `translateY(${start}px)`,
                          }
                        : {}
                }
                className={clsx("relative grid snap-start grid-cols-7 gap-px", {
                    "h-1/5": skeleton,
                })}
            >
                {week.map((day) => (
                    <DayCell
                        key={day.toISOString()}
                        day={day}
                        isCurrentMonth={
                            getMonthKey(day, calendarTimezone) ===
                            currentMonthKey
                        }
                    />
                ))}

                <EventRow events={events} week={week} size={size} />
            </div>
        )
    }
)

WeekRow.displayName = "WeekRow"
