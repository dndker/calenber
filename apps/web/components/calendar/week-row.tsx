import { normalizeCalendarLayoutOptions } from "@/lib/calendar/layout-options"
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
        const weekStartsOn = useCalendarStore((s) =>
            normalizeCalendarLayoutOptions(s.activeCalendar?.layoutOptions)
                .weekStartsOn
        )
        const hideWeekendColumns = useCalendarStore((s) =>
            normalizeCalendarLayoutOptions(s.activeCalendar?.layoutOptions)
                .hideWeekendColumns
        )
        const week = getWeek(weekDate, calendarTimezone, weekStartsOn)
        const visibleWeek = hideWeekendColumns
            ? week.filter((day) => {
                  const weekday = day.getDay()
                  return weekday !== 0 && weekday !== 6
              })
            : week

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
                className={clsx(
                    "relative grid snap-start gap-px",
                    hideWeekendColumns ? "grid-cols-5" : "grid-cols-7",
                    {
                    "h-1/5": skeleton,
                    }
                )}
            >
                {visibleWeek.map((day) => (
                    <DayCell
                        key={day.toISOString()}
                        day={day}
                        isCurrentMonth={
                            getMonthKey(day, calendarTimezone) ===
                            currentMonthKey
                        }
                    />
                ))}

                <EventRow
                    events={events}
                    week={visibleWeek}
                    size={size}
                    assumeWeekScoped
                />
            </div>
        )
    }
)

WeekRow.displayName = "WeekRow"
