import {
    formatRecurrenceBaseText,
    formatRecurrenceMenuShortText,
} from "@/components/calendar/event-form-recurrence"
import { defaultLocale, type Locale } from "@/lib/i18n/config"
import dayjs from "@/lib/dayjs"
import type { CalendarEvent } from "@/store/calendar-store.types"

function formatDate(
    target: dayjs.Dayjs,
    locale: Locale,
    options: Intl.DateTimeFormatOptions
) {
    return new Intl.DateTimeFormat(locale, options).format(target.toDate())
}

function formatMeridiemHour(target: dayjs.Dayjs, locale: Locale) {
    return formatDate(target, locale, { hour: "numeric", minute: "2-digit" })
}

function formatHour24Label(target: dayjs.Dayjs, locale: Locale) {
    return formatDate(target, locale, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    })
}

function formatShortDate(target: dayjs.Dayjs, locale: Locale) {
    return formatDate(target, locale, {
        year: "2-digit",
        month: "numeric",
        day: "numeric",
    })
}

function formatLongDate(target: dayjs.Dayjs, locale: Locale) {
    return formatDate(target, locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
    })
}

export function formatCalendarEventScheduleLabel({
    start,
    end,
    allDay,
    timezone,
    variant = "long",
    timeStyle = "meridiem",
    omitTime = false,
    locale,
}: {
    start: Date | number
    end: Date | number
    allDay?: boolean
    timezone: string
    variant?: "long" | "short"
    timeStyle?: "meridiem" | "hour24-korean"
    omitTime?: boolean
    locale?: Locale
}) {
    const zonedStart = dayjs(start).tz(timezone)
    const zonedEnd = dayjs(end).tz(timezone)
    const isSameDay = zonedStart.isSame(zonedEnd, "day")
    const isSameTime = zonedStart.valueOf() === zonedEnd.valueOf()
    const resolvedLocale = locale ?? defaultLocale
    const formatShortLabel =
        timeStyle === "hour24-korean"
            ? formatHour24Label
            : formatMeridiemHour

    if (variant === "short") {
        if (omitTime) {
            if (isSameDay) {
                return formatShortDate(zonedStart, resolvedLocale)
            }

            return `${formatShortDate(zonedStart, resolvedLocale)} - ${formatShortDate(
                zonedEnd,
                resolvedLocale
            )}`
        }

        if (allDay) {
            if (isSameDay) {
                return formatShortDate(zonedStart, resolvedLocale)
            }

            return `${formatShortDate(zonedStart, resolvedLocale)} - ${formatShortDate(
                zonedEnd,
                resolvedLocale
            )}`
        }

        if (isSameDay) {
            const formattedStartTime = formatShortLabel(
                zonedStart,
                resolvedLocale
            )

            if (isSameTime) {
                return `${formatShortDate(zonedStart, resolvedLocale)} ${formattedStartTime}`
            }

            return `${formatShortDate(zonedStart, resolvedLocale)} ${formattedStartTime} - ${formatShortLabel(
                zonedEnd,
                resolvedLocale
            )}`
        }

        return `${formatShortDate(zonedStart, resolvedLocale)} ${formatShortLabel(
            zonedStart,
            resolvedLocale
        )} - ${formatShortDate(zonedEnd, resolvedLocale)} ${formatShortLabel(zonedEnd, resolvedLocale)}`
    }

    if (allDay) {
        if (isSameDay) {
            return formatLongDate(zonedStart, resolvedLocale)
        }

        return `${formatLongDate(zonedStart, resolvedLocale)} - ${formatLongDate(zonedEnd, resolvedLocale)}`
    }

    if (isSameDay) {
        if (isSameTime) {
            return `${formatLongDate(zonedStart, resolvedLocale)} ${formatMeridiemHour(zonedStart, resolvedLocale)}`
        }

        return `${formatLongDate(zonedStart, resolvedLocale)} ${formatMeridiemHour(zonedStart, resolvedLocale)} - ${formatMeridiemHour(zonedEnd, resolvedLocale)}`
    }

    return `${formatLongDate(zonedStart, resolvedLocale)} ${formatMeridiemHour(zonedStart, resolvedLocale)} - ${formatLongDate(zonedEnd, resolvedLocale)} ${formatMeridiemHour(zonedEnd, resolvedLocale)}`
}

export function formatCalendarEventScheduleLabelFromEvent(
    event: Pick<CalendarEvent, "start" | "end" | "allDay" | "timezone">,
    options?: {
        variant?: "long" | "short"
        timeStyle?: "meridiem" | "hour24-korean"
        omitTime?: boolean
        locale?: Locale
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
        locale: options?.locale,
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
        locale?: Locale
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
            locale: options?.locale,
        })
    }

    const startDate = new Date(
        event.recurrenceInstance?.occurrenceStart ?? event.start
    )
    const detail = formatRecurrenceMenuShortText({
        recurrence: event.recurrence,
        startDate,
        timezone: event.timezone,
        locale: options?.locale,
    })
    const base = formatRecurrenceBaseText(event.recurrence, options?.locale)

    return detail ? `${base} ${detail}` : base
}
