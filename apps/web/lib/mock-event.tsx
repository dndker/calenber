import dayjs from "@/lib/dayjs"
import { CalendarEvent } from "@/store/useCalendarStore"
import { nanoid } from "nanoid"

export function generateMockEvents(timezone?: string): CalendarEvent[] {
    // console.log(
    //     typeof window === "undefined" ? "SSR" : "CSR",
    //     "generateMockEvents"
    // )

    return Array.from({ length: 20 }).map((_, i) => {
        const base = dayjs()
            .tz(timezone)
            .add(i - 5, "day")

        // 1~3일 랜덤 길이
        const durationDays = Math.floor(Math.random() * 3) + 1

        // allDay 여부 랜덤
        const isAllDay = true

        // 시작 시간 랜덤 (시간 이벤트일 때만)
        const startHour = Math.floor(Math.random() * 8) + 8 // 8~16시

        const start = isAllDay
            ? base.startOf("day")
            : base.hour(startHour).minute(0)

        const end = isAllDay
            ? start.add(durationDays - 1, "day").endOf("day")
            : start.add(Math.floor(Math.random() * 3) + 1, "hour") // 1~3시간

        return {
            id: nanoid(),
            title: `${durationDays}일 일정 ${i + 1}`,

            start: start.valueOf(),
            end: end.valueOf(),

            allDay: isAllDay,

            timezone: "Asia/Seoul",

            color: ["#3b82f6", "#22c55e", "#f97316", "#a855f7", "#ef4444"][
                i % 5
            ]!,

            createdAt: dayjs().valueOf(),
            updatedAt: dayjs().valueOf(),
        }
    })
}
