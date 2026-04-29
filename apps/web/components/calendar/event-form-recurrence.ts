import { defaultLocale, type Locale } from "@/lib/i18n/config"
import { getMessageTranslator } from "@/lib/i18n/messages"
import dayjs from "@/lib/dayjs"
import type { Dayjs } from "dayjs"

import type { EventFormValues } from "./event-form.schema"

export const recurrenceTypeLabelMap = {
    daily: "event.recurrence.daily",
    weekly: "event.recurrence.weekly",
    monthly: "event.recurrence.monthly",
    yearly: "event.recurrence.yearly",
} as const

export const recurrenceIntervalUnitLabelMap = {
    daily: "event.recurrence.intervalDay",
    weekly: "event.recurrence.intervalWeek",
    monthly: "event.recurrence.intervalMonth",
    yearly: "event.recurrence.intervalYear",
} as const

export const recurrenceWeekdayItems = [
    {
        value: 0,
        shortLabelKey: "common.weekdays.short.sun",
        fullLabelKey: "common.weekdays.long.sun",
    },
    {
        value: 1,
        shortLabelKey: "common.weekdays.short.mon",
        fullLabelKey: "common.weekdays.long.mon",
    },
    {
        value: 2,
        shortLabelKey: "common.weekdays.short.tue",
        fullLabelKey: "common.weekdays.long.tue",
    },
    {
        value: 3,
        shortLabelKey: "common.weekdays.short.wed",
        fullLabelKey: "common.weekdays.long.wed",
    },
    {
        value: 4,
        shortLabelKey: "common.weekdays.short.thu",
        fullLabelKey: "common.weekdays.long.thu",
    },
    {
        value: 5,
        shortLabelKey: "common.weekdays.short.fri",
        fullLabelKey: "common.weekdays.long.fri",
    },
    {
        value: 6,
        shortLabelKey: "common.weekdays.short.sat",
        fullLabelKey: "common.weekdays.long.sat",
    },
] as const

const textWeekdayOrder = new Map<number, number>([
    [1, 0],
    [2, 1],
    [3, 2],
    [4, 3],
    [5, 4],
    [6, 5],
    [0, 6],
])

export const recurrenceWeekdayItemsTextOrdered = [
    ...recurrenceWeekdayItems,
].sort(
    (a, b) =>
        (textWeekdayOrder.get(a.value) ?? 0) -
        (textWeekdayOrder.get(b.value) ?? 0)
)

export type RecurrenceEndMode = "never" | "until" | "count"

type RecurrenceValue = EventFormValues["recurrence"]

type RecurrenceTextOptions = {
    recurrence: RecurrenceValue | undefined
    startDate: Date
    timezone: string
    locale?: Locale
}

function getTranslator(locale: Locale = defaultLocale) {
    return getMessageTranslator(locale)
}

function formatLocaleDate(
    value: Date,
    locale: Locale,
    options: Intl.DateTimeFormatOptions
) {
    return new Intl.DateTimeFormat(locale, options).format(value)
}

function getStartDay(startDate: Date, timezone: string) {
    return dayjs.tz(startDate, timezone)
}

export function getRecurrenceMinimumUntilDate(
    startDate: Date,
    timezone: string
) {
    return getStartDay(startDate, timezone).startOf("day").toDate()
}

export function getDefaultRecurrenceUntil(
    now: Dayjs,
    startDate: Date,
    timezone: string
) {
    const today = now.startOf("day")
    const startDay = getStartDay(startDate, timezone).startOf("day")
    const defaultDay = today.isAfter(startDay) ? today : startDay

    return defaultDay.endOf("day").toISOString()
}

export function getRecurrenceFallbackWeekday(
    startDate: Date,
    timezone: string
) {
    return getStartDay(startDate, timezone).day()
}

export function normalizeRecurrenceWeekdays(
    weekdays: number[] | undefined,
    fallbackWeekday: number
) {
    const weekdayOrder = new Map<number, number>(
        recurrenceWeekdayItems.map((item, index) => [item.value, index])
    )
    const normalized = Array.from(
        new Set(
            (weekdays ?? [fallbackWeekday]).filter(
                (value) => value >= 0 && value <= 6
            )
        )
    ).sort((a, b) => (weekdayOrder.get(a) ?? 0) - (weekdayOrder.get(b) ?? 0))

    return normalized.length > 0 ? normalized : [fallbackWeekday]
}

export function getRecurrenceEndMode(
    recurrence: RecurrenceValue
): RecurrenceEndMode {
    if (!recurrence) {
        return "never"
    }

    if (recurrence.until) {
        return "until"
    }

    if (recurrence.count) {
        return "count"
    }

    return "never"
}

export function formatRecurrenceBaseText(
    recurrence: RecurrenceValue | undefined,
    locale: Locale = defaultLocale
) {
    const t = getTranslator(locale)

    if (!recurrence) {
        return t("event.recurrence.none")
    }

    const interval = Math.max(1, recurrence.interval || 1)

    return interval === 1
        ? t(recurrenceTypeLabelMap[recurrence.type])
        : t("event.recurrence.everyInterval", {
              interval,
              unit: t(recurrenceIntervalUnitLabelMap[recurrence.type]),
          })
}

function formatWeekdayText(
    weekdays: number[],
    format: "short" | "full",
    locale: Locale = defaultLocale
) {
    const t = getTranslator(locale)
    const weekdayLabelMap = new Map<
        number,
        Pick<
            (typeof recurrenceWeekdayItems)[number],
            "shortLabelKey" | "fullLabelKey"
        >
    >(recurrenceWeekdayItems.map((item) => [item.value, item]))
    const orderedWeekdays = [...weekdays].sort(
        (a, b) =>
            (textWeekdayOrder.get(a) ?? 0) - (textWeekdayOrder.get(b) ?? 0)
    )

    const labels = orderedWeekdays.map((value) => {
        const item = weekdayLabelMap.get(value)
        return item
            ? t(format === "short" ? item.shortLabelKey : item.fullLabelKey)
            : String(value)
    })

    if (format === "short") {
        return labels.join(", ")
    }

    if (labels.length === 0) {
        return ""
    }

    if (labels.length === 1) {
        return labels[0]
    }

    return labels.join(", ")
}

function formatRecurrenceStartDateText(
    startDate: Date,
    timezone: string,
    locale: Locale = defaultLocale
) {
    return formatLocaleDate(getStartDay(startDate, timezone).toDate(), locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
    })
}

function formatRecurrenceUntilDateText(
    until: string,
    timezone: string,
    locale: Locale = defaultLocale
) {
    return formatLocaleDate(dayjs.tz(until, timezone).toDate(), locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
    })
}

function formatRecurrenceUntilDateShortText(
    until: string,
    timezone: string,
    locale: Locale = defaultLocale
) {
    const t = getTranslator(locale)
    return t("event.recurrence.untilDate", {
        date: formatLocaleDate(dayjs.tz(until, timezone).toDate(), locale, {
            year: "2-digit",
            month: "2-digit",
            day: "2-digit",
        }),
    })
}

export function formatRecurrenceWeeklyWeekdaysShort({
    recurrence,
    startDate,
    timezone,
    locale,
}: RecurrenceTextOptions) {
    if (!recurrence || recurrence.type !== "weekly") {
        return undefined
    }

    return formatWeekdayText(
        normalizeRecurrenceWeekdays(
            recurrence.byWeekday,
            getRecurrenceFallbackWeekday(startDate, timezone)
        ),
        "short",
        locale
    )
}

export function formatRecurrenceWeeklyWeekdaysFull({
    recurrence,
    startDate,
    timezone,
    locale,
}: RecurrenceTextOptions) {
    if (!recurrence || recurrence.type !== "weekly") {
        return undefined
    }

    return formatWeekdayText(
        normalizeRecurrenceWeekdays(
            recurrence.byWeekday,
            getRecurrenceFallbackWeekday(startDate, timezone)
        ),
        "full",
        locale
    )
}

export function formatRecurrenceMonthlyDateText({
    recurrence,
    startDate,
    timezone,
    locale,
}: RecurrenceTextOptions) {
    if (!recurrence || recurrence.type !== "monthly") {
        return undefined
    }

    const t = getTranslator(locale)
    return t("event.recurrence.monthlyDate", {
        day: getStartDay(startDate, timezone).date(),
    })
}

export function formatRecurrenceYearlyDateText({
    recurrence,
    startDate,
    timezone,
    locale,
}: RecurrenceTextOptions) {
    if (!recurrence || recurrence.type !== "yearly") {
        return undefined
    }

    return formatLocaleDate(
        getStartDay(startDate, timezone).toDate(),
        locale ?? defaultLocale,
        {
            month: "short",
            day: "numeric",
        }
    )
}

export function formatRecurrenceDetailText(options: RecurrenceTextOptions) {
    const { recurrence } = options

    if (!recurrence) {
        return undefined
    }

    if (recurrence.type === "weekly") {
        return formatRecurrenceWeeklyWeekdaysFull(options)
    }

    if (recurrence.type === "monthly") {
        return formatRecurrenceMonthlyDateText(options)
    }

    if (recurrence.type === "yearly") {
        return formatRecurrenceYearlyDateText(options)
    }

    return undefined
}

export function formatRecurrenceMenuShortText(options: RecurrenceTextOptions) {
    const { recurrence } = options

    if (!recurrence) {
        return undefined
    }

    if (recurrence.type === "daily") {
        return undefined
    }

    if (recurrence.type === "weekly") {
        return formatRecurrenceWeeklyWeekdaysShort(options)
    }

    if (recurrence.type === "monthly") {
        return formatRecurrenceMonthlyDateText(options)
    }

    if (recurrence.type === "yearly") {
        return formatRecurrenceYearlyDateText(options)
    }

    return undefined
}

export function formatRecurrenceEndText({
    recurrence,
    startDate,
    timezone,
    locale = defaultLocale,
}: RecurrenceTextOptions) {
    if (!recurrence) {
        return undefined
    }

    const endMode = getRecurrenceEndMode(recurrence)

    if (endMode === "until" && recurrence.until) {
        return `(${formatRecurrenceStartDateText(startDate, timezone, locale)} ~ ${formatRecurrenceUntilDateText(recurrence.until, timezone, locale)})`
    }

    if (endMode === "count" && recurrence.count) {
        return getTranslator(locale)("event.recurrence.countFromStart", {
            start: formatRecurrenceStartDateText(startDate, timezone, locale),
            count: recurrence.count,
        })
    }

    return undefined
}

export function formatRecurrenceEndShortText({
    recurrence,
    timezone,
    locale = defaultLocale,
}: Pick<RecurrenceTextOptions, "recurrence" | "timezone" | "locale">) {
    if (!recurrence) {
        return undefined
    }

    const endMode = getRecurrenceEndMode(recurrence)

    if (endMode === "until" && recurrence.until) {
        return formatRecurrenceUntilDateShortText(
            recurrence.until,
            timezone,
            locale
        )
    }

    if (endMode === "count" && recurrence.count) {
        return getTranslator(locale)("event.recurrence.countOnly", {
            count: recurrence.count,
        })
    }

    return undefined
}

export function formatRecurrenceSummary(options: RecurrenceTextOptions) {
    const { recurrence } = options

    if (!recurrence) {
        return formatRecurrenceBaseText(undefined, options.locale)
    }

    const summaryParts = [formatRecurrenceBaseText(recurrence, options.locale)]
    const detail = formatRecurrenceDetailText(options)
    const end = formatRecurrenceEndText(options)

    if (detail) {
        summaryParts.push(detail)
    }

    if (end) {
        summaryParts.push(end)
    }

    return summaryParts.join(" ")
}

export function createRecurrenceValue(
    type: NonNullable<RecurrenceValue>["type"],
    currentRecurrence: RecurrenceValue,
    fallbackWeekday: number
): NonNullable<RecurrenceValue> {
    return {
        type,
        interval: currentRecurrence?.interval ?? 1,
        byWeekday:
            type === "weekly"
                ? normalizeRecurrenceWeekdays(
                      currentRecurrence?.byWeekday,
                      fallbackWeekday
                  )
                : undefined,
        until: currentRecurrence?.until,
        count: currentRecurrence?.count,
    }
}
