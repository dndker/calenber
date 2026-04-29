import dayjs from "@/lib/dayjs"
import type { Dayjs } from "dayjs"

export const calendarWeekdayOrderSundayFirst = [0, 1, 2, 3, 4, 5, 6] as const

export const calendarWeekdayOrderMondayFirst = [1, 2, 3, 4, 5, 6, 0] as const

export type CalendarWeekStartsOn = "sunday" | "monday"

export type CalendarLayoutOptions = {
    version: 1
    weekStartsOn: CalendarWeekStartsOn
    showWeekendTextColors: boolean
    showHolidayBackground: boolean
    hideWeekendColumns: boolean
}

export const DEFAULT_CALENDAR_LAYOUT_OPTIONS: CalendarLayoutOptions = {
    version: 1,
    weekStartsOn: "sunday",
    showWeekendTextColors: true,
    showHolidayBackground: true,
    hideWeekendColumns: false,
}

/** `hideWeekendColumns`가 켜진 월 그리드에서 주 배열에서 토·일 칸을 제거한다. */
export function filterCalendarWeekVisibleDays(
    week: Date[],
    hideWeekendColumns: boolean
): Date[] {
    if (!hideWeekendColumns) {
        return week
    }

    return week.filter((day) => {
        const weekday = day.getDay()
        return weekday !== 0 && weekday !== 6
    })
}

export function normalizeCalendarLayoutOptions(
    value: unknown
): CalendarLayoutOptions {
    if (!value || typeof value !== "object") {
        return DEFAULT_CALENDAR_LAYOUT_OPTIONS
    }

    const source = value as Partial<CalendarLayoutOptions>
    const weekStartsOn =
        source.weekStartsOn === "monday" ? "monday" : "sunday"
    return {
        version: 1,
        weekStartsOn,
        showWeekendTextColors: source.showWeekendTextColors !== false,
        showHolidayBackground: source.showHolidayBackground !== false,
        hideWeekendColumns: source.hideWeekendColumns === true,
    }
}

export function getCalendarWeekStartIndex(weekStartsOn: CalendarWeekStartsOn) {
    return weekStartsOn === "monday" ? 1 : 0
}

export function getCalendarWeekdayLabels(weekStartsOn: CalendarWeekStartsOn) {
    return weekStartsOn === "monday"
        ? calendarWeekdayOrderMondayFirst
        : calendarWeekdayOrderSundayFirst
}

export function getCalendarWeekStart(
    date: Date | number | Dayjs,
    timezone: string,
    weekStartsOn: CalendarWeekStartsOn
) {
    const target = dayjs.tz(date, timezone).startOf("day")
    const weekday = target.day()
    const diff =
        (weekday - getCalendarWeekStartIndex(weekStartsOn) + 7) % 7

    return target.subtract(diff, "day")
}
