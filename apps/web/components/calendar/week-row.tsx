import { getMonthKey } from "@/utils/calendar"
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
        visibleWeek,
        calendarTz,
        currentMonthKey,
        skeleton = false,
    }: {
        events: PositionedCalendarEvent[]
        start?: number
        skeleton?: boolean
        size?: number
        visibleWeek: Date[]
        calendarTz: string
        currentMonthKey: string
    }) => {
        const firstVisibleDay = visibleWeek[0]
        const lastVisibleDay = visibleWeek[visibleWeek.length - 1]

        if (!firstVisibleDay || !lastVisibleDay) {
            return null
        }

        const firstMonthKey = getMonthKey(firstVisibleDay, calendarTz)
        const lastMonthKey = getMonthKey(lastVisibleDay, calendarTz)
        const showsWeekendColumns = visibleWeek.length > 5

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
                    showsWeekendColumns ? "grid-cols-7" : "grid-cols-5",
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
                            (firstMonthKey === currentMonthKey &&
                                getMonthKey(day, calendarTz) ===
                                    firstMonthKey) ||
                            (lastMonthKey === currentMonthKey &&
                                getMonthKey(day, calendarTz) === lastMonthKey)
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
        prev.calendarTz === next.calendarTz &&
        prev.currentMonthKey === next.currentMonthKey &&
        prev.visibleWeek === next.visibleWeek
)

WeekRow.displayName = "WeekRow"
