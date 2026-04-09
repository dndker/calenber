import dayjs from "@/lib/dayjs"

export const DAYS = 7
export const TOTAL = 100000
export const CENTER_INDEX = 50000

export function getWeekOffset(
    base: Date,
    offset: number,
    timezone: string = "Asia/Seoul"
) {
    const d = dayjs.tz(base, timezone).toDate()
    d.setDate(d.getDate() + offset * 7)
    return d
}

export function getWeek(date: Date, timezone: string = "Asia/Seoul") {
    const start = dayjs.tz(date, timezone).toDate()
    const day = start.getDay()
    start.setDate(start.getDate() - day)

    const week: Date[] = []
    for (let i = 0; i < DAYS; i++) {
        const d = dayjs(start).toDate()
        d.setDate(start.getDate() + i)
        week.push(d)
    }
    return week
}

export function getMonthKey(date: Date) {
    return `${date.getFullYear()}-${date.getMonth()}`
}
