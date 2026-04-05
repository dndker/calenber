import { getMonthKey, getWeek } from "@/utils/calendar"
import { memo, useMemo } from "react"
import { DayCell } from "./day-cell"

export const WeekRow = memo(
    ({
        start,
        size,
        weekDate,
        currentMonthKey,
    }: {
        start: number
        size: number
        weekDate: Date
        currentMonthKey: string
    }) => {
        const week = useMemo(() => getWeek(weekDate), [weekDate])

        return (
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: size,
                    transform: `translateY(${start}px)`,
                }}
                className="grid snap-start grid-cols-7 gap-px"
            >
                {week.map((day) => (
                    <DayCell
                        key={day.toISOString()}
                        day={day}
                        isCurrentMonth={getMonthKey(day) === currentMonthKey}
                    />
                ))}
            </div>
        )
    }
)

WeekRow.displayName = "WeekRow"
