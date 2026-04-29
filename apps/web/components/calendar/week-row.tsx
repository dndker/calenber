import {
    filterCalendarWeekVisibleDays,
    normalizeCalendarLayoutOptions,
} from "@/lib/calendar/layout-options"
import { shallow } from "@/store/createSSRStore"
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
        const {
            calendarTimezone,
            weekStartsOn,
            hideWeekendColumns,
        } = useCalendarStore(
            (s) => {
                const layout = normalizeCalendarLayoutOptions(
                    s.activeCalendar?.layoutOptions
                )
                return {
                    calendarTimezone: s.calendarTimezone,
                    weekStartsOn: layout.weekStartsOn,
                    hideWeekendColumns: layout.hideWeekendColumns,
                }
            },
            shallow
        )
        const week = getWeek(weekDate, calendarTimezone, weekStartsOn)
        const visibleWeek = filterCalendarWeekVisibleDays(
            week,
            hideWeekendColumns
        )

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
    },
    (prev, next) =>
        prev.events === next.events &&
        prev.start === next.start &&
        prev.size === next.size &&
        prev.skeleton === next.skeleton &&
        prev.currentMonthKey === next.currentMonthKey &&
        prev.weekDate.getTime() === next.weekDate.getTime()
)

WeekRow.displayName = "WeekRow"
