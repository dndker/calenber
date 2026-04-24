import dayjs from "@/lib/dayjs"
import type { Dayjs } from "dayjs"

import type { EventFormValues } from "./event-form.schema"

export const recurrenceTypeLabelMap = {
    daily: "매일",
    weekly: "매주",
    monthly: "매월",
    yearly: "매년",
} as const

export const recurrenceIntervalUnitLabelMap = {
    daily: "일",
    weekly: "주",
    monthly: "개월",
    yearly: "년",
} as const

export const recurrenceWeekdayItems = [
    { value: 0, shortLabel: "일", fullLabel: "일요일" },
    { value: 1, shortLabel: "월", fullLabel: "월요일" },
    { value: 2, shortLabel: "화", fullLabel: "화요일" },
    { value: 3, shortLabel: "수", fullLabel: "수요일" },
    { value: 4, shortLabel: "목", fullLabel: "목요일" },
    { value: 5, shortLabel: "금", fullLabel: "금요일" },
    { value: 6, shortLabel: "토", fullLabel: "토요일" },
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
    recurrence: RecurrenceValue | undefined
) {
    if (!recurrence) {
        return "반복 안 함"
    }

    const interval = Math.max(1, recurrence.interval || 1)

    return interval === 1
        ? recurrenceTypeLabelMap[recurrence.type]
        : `${interval}${recurrenceIntervalUnitLabelMap[recurrence.type]}마다`
}

function formatWeekdayText(weekdays: number[], format: "short" | "full") {
    const weekdayLabelMap = new Map<
        number,
        Pick<
            (typeof recurrenceWeekdayItems)[number],
            "shortLabel" | "fullLabel"
        >
    >(recurrenceWeekdayItems.map((item) => [item.value, item]))
    const orderedWeekdays = [...weekdays].sort(
        (a, b) =>
            (textWeekdayOrder.get(a) ?? 0) - (textWeekdayOrder.get(b) ?? 0)
    )

    const labels = orderedWeekdays.map((value) => {
        const item = weekdayLabelMap.get(value)
        return item ? item.shortLabel : String(value)
    })

    if (format === "short") {
        return labels.join(", ")
    }

    if (labels.length === 0) {
        return ""
    }

    if (labels.length === 1) {
        return `${labels[0]}요일`
    }

    return `${labels.join(", ")}요일`
}

function formatRecurrenceStartDateText(startDate: Date, timezone: string) {
    return getStartDay(startDate, timezone).format("YYYY.MM.DD(dd)")
}

function formatRecurrenceUntilDateText(until: string, timezone: string) {
    return dayjs.tz(until, timezone).format("YYYY.MM.DD(dd)")
}

function formatRecurrenceUntilDateShortText(until: string, timezone: string) {
    return `${dayjs.tz(until, timezone).format("YY.MM.DD")} 까지`
}

export function formatRecurrenceWeeklyWeekdaysShort({
    recurrence,
    startDate,
    timezone,
}: RecurrenceTextOptions) {
    if (!recurrence || recurrence.type !== "weekly") {
        return undefined
    }

    return formatWeekdayText(
        normalizeRecurrenceWeekdays(
            recurrence.byWeekday,
            getRecurrenceFallbackWeekday(startDate, timezone)
        ),
        "short"
    )
}

export function formatRecurrenceWeeklyWeekdaysFull({
    recurrence,
    startDate,
    timezone,
}: RecurrenceTextOptions) {
    if (!recurrence || recurrence.type !== "weekly") {
        return undefined
    }

    return formatWeekdayText(
        normalizeRecurrenceWeekdays(
            recurrence.byWeekday,
            getRecurrenceFallbackWeekday(startDate, timezone)
        ),
        "full"
    )
}

export function formatRecurrenceMonthlyDateText({
    recurrence,
    startDate,
    timezone,
}: RecurrenceTextOptions) {
    if (!recurrence || recurrence.type !== "monthly") {
        return undefined
    }

    return `${getStartDay(startDate, timezone).date()}일`
}

export function formatRecurrenceYearlyDateText({
    recurrence,
    startDate,
    timezone,
}: RecurrenceTextOptions) {
    if (!recurrence || recurrence.type !== "yearly") {
        return undefined
    }

    return getStartDay(startDate, timezone).format("M월 D일")
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
}: RecurrenceTextOptions) {
    if (!recurrence) {
        return undefined
    }

    const endMode = getRecurrenceEndMode(recurrence)

    if (endMode === "until" && recurrence.until) {
        return `(${formatRecurrenceStartDateText(startDate, timezone)} ~ ${formatRecurrenceUntilDateText(recurrence.until, timezone)})`
    }

    if (endMode === "count" && recurrence.count) {
        return `(${formatRecurrenceStartDateText(startDate, timezone)}부터 ${recurrence.count}회)`
    }

    return undefined
}

export function formatRecurrenceEndShortText({
    recurrence,
    timezone,
}: Pick<RecurrenceTextOptions, "recurrence" | "timezone">) {
    if (!recurrence) {
        return undefined
    }

    const endMode = getRecurrenceEndMode(recurrence)

    if (endMode === "until" && recurrence.until) {
        return formatRecurrenceUntilDateShortText(recurrence.until, timezone)
    }

    if (endMode === "count" && recurrence.count) {
        return `${recurrence.count}회`
    }

    return undefined
}

export function formatRecurrenceSummary(options: RecurrenceTextOptions) {
    const { recurrence } = options

    if (!recurrence) {
        return "반복 안 함"
    }

    const summaryParts = [formatRecurrenceBaseText(recurrence)]
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
