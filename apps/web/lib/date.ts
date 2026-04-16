import dayjs from "@/lib/dayjs"
import type { CalendarEvent } from "@/store/calendar-store.types"

// 👉 캘린더 기준 변환 (핵심)
export function toCalendarDay(date: number | Date | string, tz: string) {
    return dayjs(date).tz(tz, true).startOf("day").valueOf()
}

// 👉 이벤트 → 캘린더 변환
export function eventToCalendar(
    event: { timezone: string },
    date: number,
    calendarTz: string
) {
    return dayjs(date).tz(event.timezone).tz(calendarTz)
}

// 👉 날짜 차이 (안전)
export function diffDays(start: number, end: number, tz: string) {
    return dayjs(end).tz(tz).diff(dayjs(start).tz(tz), "day")
}

export function getEventDuration(event: {
    start: number
    end: number
    timezone: string
}) {
    return dayjs(event.end)
        .tz(event.timezone)
        .diff(dayjs(event.start).tz(event.timezone), "millisecond")
}

export function toCalendarRange(event: CalendarEvent, calendarTz: string) {
    // ✅ 올데이 이벤트는 tz 변환 금지
    if (event.allDay) {
        const start = dayjs(event.start).startOf("day")
        const end = dayjs(event.end).startOf("day")

        return {
            startDay: start,
            endDay: end,
        }
    }

    // ✅ 일반 이벤트만 tz 변환
    const start = eventToCalendar(event, event.start, calendarTz)
    const end = eventToCalendar(event, event.end, calendarTz)

    return {
        startDay: start.startOf("day"),
        endDay: end.startOf("day"),
    }
}
