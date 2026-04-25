import {
    formatRecurrenceBaseText,
    formatRecurrenceMenuShortText,
} from "@/components/calendar/event-form-recurrence"
import dayjs from "@/lib/dayjs"
import type { CalendarEvent } from "@/store/calendar-store.types"

function formatMeridiemHour(target: dayjs.Dayjs) {
    const hour = target.hour()
    const minute = target.minute()
    const meridiem = hour < 12 ? "오전" : "오후"
    const hour12 = hour % 12 === 0 ? 12 : hour % 12
    const minuteTime = minute !== 0 ? ` ${minute}분` : ""

    return `${meridiem} ${hour12}시${minuteTime}`
}

function formatHour24Korean(target: dayjs.Dayjs) {
    const hour = target.hour()
    const minute = target.minute()

    if (minute === 0) {
        return `${hour}시`
    }

    return `${hour}시 ${minute}분`
}

function formatShortKoreanDate(target: dayjs.Dayjs) {
    return target.format("YY년 M월 D일")
}

export function formatCalendarEventScheduleLabel({
    start,
    end,
    allDay,
    timezone,
    variant = "long",
    timeStyle = "meridiem",
    omitTime = false,
}: {
    start: Date | number
    end: Date | number
    allDay?: boolean
    timezone: string
    variant?: "long" | "short"
    timeStyle?: "meridiem" | "hour24-korean"
    omitTime?: boolean
}) {
    const zonedStart = dayjs(start).tz(timezone)
    const zonedEnd = dayjs(end).tz(timezone)
    const isSameDay = zonedStart.isSame(zonedEnd, "day")
    const isSameTime = zonedStart.valueOf() === zonedEnd.valueOf()
    const formatShortLabel =
        timeStyle === "hour24-korean" ? formatHour24Korean : formatMeridiemHour

    if (variant === "short") {
        if (omitTime) {
            if (isSameDay) {
                return formatShortKoreanDate(zonedStart)
            }

            return `${formatShortKoreanDate(zonedStart)} - ${formatShortKoreanDate(
                zonedEnd
            )}`
        }

        if (allDay) {
            if (isSameDay) {
                return formatShortKoreanDate(zonedStart)
            }

            return `${formatShortKoreanDate(zonedStart)} - ${formatShortKoreanDate(
                zonedEnd
            )}`
        }

        if (isSameDay) {
            const formattedStartTime = formatShortLabel(zonedStart)

            if (isSameTime) {
                return `${formatShortKoreanDate(zonedStart)} ${formattedStartTime}`
            }

            return `${formatShortKoreanDate(zonedStart)} ${formattedStartTime} - ${formatShortLabel(
                zonedEnd
            )}`
        }

        return `${formatShortKoreanDate(zonedStart)} ${formatShortLabel(
            zonedStart
        )} - ${formatShortKoreanDate(zonedEnd)} ${formatShortLabel(zonedEnd)}`
    }

    if (allDay) {
        if (isSameDay) {
            return zonedStart.format("YYYY년 M월 D일")
        }

        return `${zonedStart.format("YYYY년 M월 D일")} - ${zonedEnd.format(
            "YYYY년 M월 D일"
        )}`
    }

    if (isSameDay) {
        if (isSameTime) {
            return `${zonedStart.format("YYYY년 M월 D일")} ${formatMeridiemHour(
                zonedStart
            )}`
        }

        return `${zonedStart.format("YYYY년 M월 D일")} ${formatMeridiemHour(
            zonedStart
        )} - ${formatMeridiemHour(zonedEnd)}`
    }

    return `${zonedStart.format("YYYY년 M월 D일")} ${formatMeridiemHour(
        zonedStart
    )} - ${zonedEnd.format("YYYY년 M월 D일")} ${formatMeridiemHour(zonedEnd)}`
}

export function formatCalendarEventScheduleLabelFromEvent(
    event: Pick<CalendarEvent, "start" | "end" | "allDay" | "timezone">,
    options?: {
        variant?: "long" | "short"
        timeStyle?: "meridiem" | "hour24-korean"
        omitTime?: boolean
    }
) {
    return formatCalendarEventScheduleLabel({
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        timezone: event.timezone,
        variant: options?.variant,
        timeStyle: options?.timeStyle,
        omitTime: options?.omitTime,
    })
}

export function formatCalendarEventRecurrenceOrDateLabel(
    event: Pick<
        CalendarEvent,
        | "start"
        | "end"
        | "allDay"
        | "timezone"
        | "recurrence"
        | "recurrenceInstance"
    >,
    options?: {
        scheduleVariant?: "long" | "short"
        timeStyle?: "meridiem" | "hour24-korean"
        omitTime?: boolean
    }
) {
    if (!event.recurrence) {
        return formatCalendarEventScheduleLabel({
            start: event.start,
            end: event.end,
            allDay: event.allDay,
            timezone: event.timezone,
            variant: options?.scheduleVariant ?? "short",
            timeStyle: options?.timeStyle,
            omitTime: options?.omitTime,
        })
    }

    const startDate = new Date(
        event.recurrenceInstance?.occurrenceStart ?? event.start
    )
    const detail = formatRecurrenceMenuShortText({
        recurrence: event.recurrence,
        startDate,
        timezone: event.timezone,
    })
    const base = formatRecurrenceBaseText(event.recurrence)

    return detail ? `${base} ${detail}` : base
}
