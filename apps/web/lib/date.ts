import dayjs from "@/lib/dayjs"

// ✅ 기본 tz 적용
export function dz(date: number | Date | string, tz: string) {
    return dayjs(date).tz(tz)
}

// ✅ 이벤트 전용
export function de(event: { timezone: string }, date: number) {
    return dayjs(date).tz(event.timezone)
}

// ✅ 하루 시작
export function startOfDay(date: number | Date, tz: string) {
    return dayjs(date).tz(tz).startOf("day")
}

// ✅ 하루 끝
export function endOfDay(date: number | Date, tz: string) {
    return dayjs(date).tz(tz).endOf("day")
}
