import dayjs from "@/lib/dayjs"

/**
 * Matches "하루종일" → timed toggle in the event form: preserve the original
 * start/end calendar dates, while applying wall-clock +1h / +2h from "now"
 * in `timezoneId` to the start and end boundaries.
 */
export function getTimedScheduleRangeAfterAllDayOff(
    timezoneId: string,
    startDaySource: Date,
    endDaySource: Date
): { start: Date; end: Date } {
    const tz = timezoneId?.trim() || "Asia/Seoul"
    const toggleNow = dayjs().tz(tz)
    const startDay = dayjs(startDaySource).tz(tz).startOf("day")
    const endDay = dayjs(endDaySource).tz(tz).startOf("day")
    const nextStartSlot = toggleNow
        .add(1, "hour")
        .minute(0)
        .second(0)
        .millisecond(0)
    const nextEndSlot = toggleNow
        .add(2, "hour")
        .minute(0)
        .second(0)
        .millisecond(0)
    const dayStart = toggleNow.startOf("day")
    const start = startDay
        .add(nextStartSlot.diff(dayStart, "minute"), "minute")
        .toDate()
    const end = endDay
        .add(nextEndSlot.diff(dayStart, "minute"), "minute")
        .toDate()
    return {
        start: dayjs(start).tz(tz).minute(0).second(0).millisecond(0).toDate(),
        end: dayjs(end).tz(tz).minute(0).second(0).millisecond(0).toDate(),
    }
}

/** New event defaults: 현재 시각(일정 타임존 기준) +1h / +2h, 간격 1시간. */
export function getDefaultNewEventTimedSchedule(timezoneId: string): {
    start: Date
    end: Date
} {
    const tz = timezoneId?.trim() || "Asia/Seoul"
    const now = dayjs().tz(tz)

    return {
        start: now
            .add(1, "hour")
            .minute(0)
            .second(0)
            .millisecond(0)
            .toDate(),
        end: now
            .add(2, "hour")
            .minute(0)
            .second(0)
            .millisecond(0)
            .toDate(),
    }
}

/**
 * 클릭한 날의 달력 날짜에, 지금 기준 +1h / +2h 시·분(초는 0)을 붙인다.
 * 캘린더 더블클릭으로 넘어온 하루 전체 구간(startOf~endOf)을 덮어쓸 때 사용.
 */
export function getTimedScheduleOnDayFromNowPlusHours(
    timezoneId: string,
    anchorDaySource: Date
): { start: Date; end: Date } {
    const tz = timezoneId?.trim() || "Asia/Seoul"
    const dayBase = dayjs(anchorDaySource).tz(tz).startOf("day")
    const plus1 = dayjs()
        .tz(tz)
        .add(1, "hour")
        .minute(0)
        .second(0)
        .millisecond(0)
    const plus2 = dayjs()
        .tz(tz)
        .add(2, "hour")
        .minute(0)
        .second(0)
        .millisecond(0)

    const start = dayBase
        .hour(plus1.hour())
        .minute(0)
        .second(0)
        .millisecond(0)
        .toDate()
    const end = dayBase
        .hour(plus2.hour())
        .minute(0)
        .second(0)
        .millisecond(0)
        .toDate()

    if (end.getTime() <= start.getTime()) {
        return {
            start,
            end: dayjs(start)
                .tz(tz)
                .add(1, "hour")
                .minute(0)
                .second(0)
                .millisecond(0)
                .toDate(),
        }
    }

    return { start, end }
}

/**
 * 멀티데이 드래그: 시작일 0시 기준 첫 셀 날짜에 (현재+1h) 시각을 붙이고,
 * 종료는 그보다 정확히 24시간 뒤 → 시작·종료 시·분은 같고 날짜만 하루 차이(24시간 길이).
 * (끝 셀 날짜는 길이 계산에 쓰지 않음.)
 */
export function getTimedScheduleForMultiDayRange(
    timezoneId: string,
    firstDaySource: Date,
    _lastDaySource: Date
): { start: Date; end: Date } {
    const tz = timezoneId?.trim() || "Asia/Seoul"
    const plus1 = dayjs()
        .tz(tz)
        .add(1, "hour")
        .minute(0)
        .second(0)
        .millisecond(0)

    const startDayBase = dayjs(firstDaySource).tz(tz).startOf("day")

    const start = startDayBase
        .hour(plus1.hour())
        .minute(0)
        .second(0)
        .millisecond(0)
        .toDate()

    const end = dayjs(start)
        .tz(tz)
        .add(24, "hour")
        .minute(0)
        .second(0)
        .millisecond(0)
        .toDate()

    return { start, end }
}

export type OpenEventSchedulePayload =
    | undefined
    | {
          /** 월 그리드 셀(더블클릭/+/드래그)에서만 전달 */
          fromCalendarGrid: true
          start: number
          end: number
      }

/**
 * - payload 없음: 오늘 +1h / +2h (사이드바「일정 생성하기」 등)
 * - fromCalendarGrid: 단일 셀은 해당 날 +1/+2h, 멀티 데이 드래그는 첫 날 +1h 후 시작·정확히 24h 후 종료(같은 시·분)
 */
export function resolveOpenEventSchedule(
    timezoneId: string,
    payload?: OpenEventSchedulePayload
): { start: Date; end: Date } {
    const tz = timezoneId?.trim() || "Asia/Seoul"

    if (!payload?.fromCalendarGrid) {
        return getDefaultNewEventTimedSchedule(tz)
    }

    const s = dayjs(payload.start).tz(tz)
    const e = dayjs(payload.end).tz(tz)
    const dayEndMs = s.startOf("day").endOf("day").valueOf()
    const isDoubleClickFullDay =
        s.isSame(e, "day") && Math.abs(payload.end - dayEndMs) <= 2

    const isMultiDayRange = !s.isSame(e, "day")

    if (isMultiDayRange) {
        return getTimedScheduleForMultiDayRange(
            tz,
            new Date(payload.start),
            new Date(payload.end)
        )
    }

    if (isDoubleClickFullDay) {
        const placed = getTimedScheduleOnDayFromNowPlusHours(
            tz,
            new Date(payload.start)
        )
        const anchorDay = s.startOf("day")
        const todayDay = dayjs().tz(tz).startOf("day")
        if (
            anchorDay.isSame(todayDay, "day") &&
            placed.start.getTime() < Date.now()
        ) {
            return getDefaultNewEventTimedSchedule(tz)
        }
        return placed
    }

    return getTimedScheduleOnDayFromNowPlusHours(tz, new Date(payload.start))
}
