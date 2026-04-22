import dayjs from "@/lib/dayjs"
import { useCalendarStore } from "@/store/useCalendarStore"
import { getMonthKey } from "@/utils/calendar"
import { WeekRow } from "./week-row"

export function MonthSkeleton() {
    const calendarTimezone = useCalendarStore((s) => s.calendarTimezone)
    const selectedDate = useCalendarStore((s) => s.selectedDate)
    const today = dayjs(selectedDate).tz(calendarTimezone).add(12, "hour")
    const startOfMonth = today.startOf("month")

    const calendarStart = startOfMonth.startOf("week")

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
