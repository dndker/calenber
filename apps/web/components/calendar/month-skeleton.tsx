import { getMonthKey } from "@/utils/calendar"
import dayjs from "dayjs"
import { WeekRow } from "./week-row"

export function MonthSkeleton() {
    const today = dayjs()
    const startOfMonth = today.startOf("month")

    // 달력 시작 주 (일요일 or 월요일 기준)
    const calendarStart = startOfMonth.startOf("week")

    const monthKey = getMonthKey(startOfMonth.toDate())

    return (
        <div className="relative flex h-full flex-col gap-px">
            {Array.from({ length: 5 }).map((_, i) => {
                const weekDate = calendarStart.add(i, "week").toDate()

                return (
                    <WeekRow
                        key={i}
                        weekDate={weekDate}
                        currentMonthKey={monthKey}
                        skeleton
                    />
                )
            })}
        </div>
    )
}
