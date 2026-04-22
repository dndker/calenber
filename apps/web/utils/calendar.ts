import dayjs from "@/lib/dayjs"

export const DAYS = 7
export const TOTAL = 100000
export const CENTER_INDEX = 50000

export function getWeekOffset(
    base: Date,
    offset: number,
    timezone: string = "Asia/Seoul"
) {
    return dayjs
        .tz(base, timezone)
        .startOf("isoWeek")
        .add(offset, "week")
        .add(12, "hour")
        .toDate()
}

export function getWeek(date: Date, timezone: string = "Asia/Seoul") {
    const start = dayjs.tz(date, timezone).startOf("isoWeek")

    return Array.from({ length: DAYS }, (_, i) =>
        start.add(i, "day").add(12, "hour").toDate()
    )
}

export function getMonthKey(date: Date, timezone: string = "Asia/Seoul") {
    return dayjs.tz(date, timezone).format("YYYY-MM")
}
