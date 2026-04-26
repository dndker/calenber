import dayjs from "@/lib/dayjs"
import { getCalendarWeekStart, normalizeCalendarLayoutOptions } from "@/lib/calendar/layout-options"
import { useCalendarStore } from "@/store/useCalendarStore"
import { getMonthKey } from "@/utils/calendar"
import { WeekRow } from "./week-row"

export function MonthSkeleton() {
    const calendarTimezone = useCalendarStore((s) => s.calendarTimezone)
    const weekStartsOn = useCalendarStore((s) =>
        normalizeCalendarLayoutOptions(s.activeCalendar?.layoutOptions).weekStartsOn
    )
    const selectedDate = useCalendarStore((s) => s.selectedDate)
    const today = dayjs(selectedDate).tz(calendarTimezone).add(12, "hour")
    const startOfMonth = today.startOf("month")

    const calendarStart = getCalendarWeekStart(
        startOfMonth.toDate(),
        calendarTimezone,
        weekStartsOn
    )

    const monthKey = getMonthKey(startOfMonth.toDate(), calendarTimezone)

    return (
        <div className="relative flex h-full flex-col gap-px">
            {Array.from({ length: 5 }).map((_, i) => {
                const weekDate = calendarStart.add(i, "week").toDate()

                return (
                    <WeekRow
                        key={i}
                        events={[]}
                        weekDate={weekDate}
                        currentMonthKey={monthKey}
                        skeleton
                        // size={item.size}
                    />
                )
            })}
        </div>
    )
}
