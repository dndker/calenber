import {
    getCalendarWeekdayLabels,
    normalizeCalendarLayoutOptions,
} from "@/lib/calendar/layout-options"
import { useCalendarStore } from "@/store/useCalendarStore"
import { useFormatter } from "next-intl"
import { memo } from "react"

export const MonthHeader = memo(() => {
    const format = useFormatter()
    const weekStartsOn = useCalendarStore(
        (s) =>
            normalizeCalendarLayoutOptions(s.activeCalendar?.layoutOptions)
                .weekStartsOn
    )
    const showWeekendTextColors = useCalendarStore(
        (s) =>
            normalizeCalendarLayoutOptions(s.activeCalendar?.layoutOptions)
                .showWeekendTextColors
    )
    const showHolidayBackground = useCalendarStore(
        (s) =>
            normalizeCalendarLayoutOptions(s.activeCalendar?.layoutOptions)
                .showHolidayBackground
    )
    const hideWeekendColumns = useCalendarStore(
        (s) =>
            normalizeCalendarLayoutOptions(s.activeCalendar?.layoutOptions)
                .hideWeekendColumns
    )
    const weekdays = getCalendarWeekdayLabels(weekStartsOn)
    const visibleWeekdays = hideWeekendColumns
        ? weekdays.filter((weekday) => weekday !== 0 && weekday !== 6)
        : weekdays

    return (
        <div
            className="grid shrink-0 gap-px border-b border-border/65"
            style={{
                gridTemplateColumns: `repeat(${visibleWeekdays.length || 1}, minmax(0, 1fr))`,
            }}
        >
            {visibleWeekdays.map((weekday, index) => {
                const isSunday = weekday === 0
                const isSaturday = weekday === 6
                const weekendTextColor =
                    showWeekendTextColors && isSunday
                        ? "text-red-500/95 dark:text-red-500/80"
                        : showWeekendTextColors && isSaturday
                          ? "text-blue-500/80"
                          : "text-muted-foreground"

                const weekendBackground =
                    showHolidayBackground && (isSunday || isSaturday)
                        ? "bg-background/85"
                        : "bg-background"

                return (
                    <div
                        key={`${weekday}-${index}`}
                        className={`px-3 py-2 text-right text-sm font-medium ${weekendBackground} ${weekendTextColor}`}
                    >
                        <span className="inline-block w-8 text-center">
                            {format.dateTime(new Date(2026, 3, 26 + weekday), {
                                weekday: "short",
                            })}
                        </span>
                    </div>
                )
            })}
        </div>
    )
})

MonthHeader.displayName = "MonthHeader"
