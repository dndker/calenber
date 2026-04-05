export const DAYS = 7
export const TOTAL = 100000
export const CENTER_INDEX = 50000

export function getWeekOffset(base: Date, offset: number) {
    const d = new Date(base)
    d.setDate(d.getDate() + offset * 7)
    return d
}

export function getWeek(date: Date) {
    const start = new Date(date)
    const day = start.getDay()
    start.setDate(start.getDate() - day)

    const week: Date[] = []
    for (let i = 0; i < DAYS; i++) {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        week.push(d)
    }
    return week
}

export function getMonthKey(date: Date) {
    return `${date.getFullYear()}-${date.getMonth()}`
}
