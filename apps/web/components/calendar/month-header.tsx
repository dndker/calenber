import {
    getCalendarWeekdayLabels,
    normalizeCalendarLayoutOptions,
} from "@/lib/calendar/layout-options"
import { useCalendarStore } from "@/store/useCalendarStore"
import { memo } from "react"

export const MonthHeader = memo(() => {
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
    const labels = getCalendarWeekdayLabels(weekStartsOn)
    const visibleLabels = hideWeekendColumns
        ? labels.filter((label) => label !== "일" && label !== "토")
        : labels

    return (
        <div
            className="grid shrink-0 gap-px border-b border-border/65"
            style={{
                gridTemplateColumns: `repeat(${visibleLabels.length || 1}, minmax(0, 1fr))`,
            }}
        >
            {visibleLabels.map((d, index) => {
                const isSunday = d === "일"
                const isSaturday = d === "토"
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
                        key={`${d}-${index}`}
                        className={`px-3 py-2 text-right text-sm font-medium ${weekendBackground} ${weekendTextColor}`}
                    >
                        <span className="inline-block w-8 text-center">
                            {d}
                        </span>
                    </div>
                )
            })}
        </div>
    )
})

MonthHeader.displayName = "MonthHeader"
