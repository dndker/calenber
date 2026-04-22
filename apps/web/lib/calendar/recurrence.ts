import { toCalendarRange } from "@/lib/date"
import dayjs from "@/lib/dayjs"
import type { CalendarEvent } from "@/store/calendar-store.types"

const MAX_OCCURRENCES_PER_EVENT = 512

function buildExceptionDateKeySet(event: CalendarEvent, timezone: string) {
    return new Set(
        (event.exceptions ?? []).map((exception) =>
            dayjs(exception).tz(timezone).format("YYYY-MM-DD")
        )
    )
}

function normalizeWeekday(value: number) {
    return ((value % 7) + 7) % 7
}

function normalizeRecurrenceWeekdays(
    weekdays: number[] | undefined,
    fallbackWeekday: number
) {
    const normalized = Array.from(
        new Set(
            (weekdays?.length ? weekdays : [fallbackWeekday]).map(
                normalizeWeekday
            )
        )
    ).sort((a, b) => a - b)

    return normalized.length > 0
        ? normalized
        : [normalizeWeekday(fallbackWeekday)]
}

function doesEventIntersectRange(
    event: CalendarEvent,
    rangeStart: number,
    rangeEnd: number,
    calendarTz: string
) {
    const { startDay, endDay } = toCalendarRange(event, calendarTz)

    return (
        endDay.add(1, "day").valueOf() > rangeStart &&
        startDay.valueOf() < rangeEnd
    )
}

function buildRecurringOccurrence(
    event: CalendarEvent,
    occurrenceStart: number,
    occurrenceEnd: number
): CalendarEvent {
    return {
        ...event,
        start: occurrenceStart,
        end: occurrenceEnd,
        recurrenceInstance: {
            key: `${event.id}:${occurrenceStart}`,
            sourceEventId: event.id,
            sourceStart: event.start,
            sourceEnd: event.end,
            occurrenceStart,
            occurrenceEnd,
        },
    }
}

function appendEventDateKeys(
    dateKeys: Set<string>,
    event: CalendarEvent,
    calendarTz: string
) {
    const { startDay, endDay } = toCalendarRange(event, calendarTz)
    let cursor = startDay.startOf("day")
    const endCursor = endDay.startOf("day")

    while (cursor.isSameOrBefore(endCursor, "day")) {
        dateKeys.add(cursor.format("YYYY-MM-DD"))
        cursor = cursor.add(1, "day")
    }
}

function addOccurrenceIfVisible(
    results: CalendarEvent[],
    event: CalendarEvent,
    occurrenceStart: dayjs.Dayjs,
    durationMs: number,
    exceptionDateKeys: Set<string>,
    rangeStart: number,
    rangeEnd: number,
    calendarTz: string
) {
    const occurrenceDateKey = occurrenceStart.format("YYYY-MM-DD")

    if (exceptionDateKeys.has(occurrenceDateKey)) {
        return
    }

    const occurrence = buildRecurringOccurrence(
        event,
        occurrenceStart.valueOf(),
        occurrenceStart.add(durationMs, "millisecond").valueOf()
    )

    if (doesEventIntersectRange(occurrence, rangeStart, rangeEnd, calendarTz)) {
        results.push(occurrence)
    }
}

function getRecurrenceUntilDay(
    recurrence: NonNullable<CalendarEvent["recurrence"]>,
    timezone: string
) {
    return recurrence.until
        ? dayjs(recurrence.until).tz(timezone).endOf("day")
        : null
}

function buildMonthlyOrYearlyOccurrence(
    start: dayjs.Dayjs,
    frequency: "month" | "year",
    step: number
) {
    const monthValue =
        frequency === "month"
            ? start.month() + step
            : start.month()
    const yearValue =
        frequency === "month"
            ? start.year() + Math.floor(monthValue / 12)
            : start.year() + step
    const normalizedMonth = ((monthValue % 12) + 12) % 12
    const candidate = start
        .year(yearValue)
        .month(normalizedMonth)
        .date(1)
        .hour(start.hour())
        .minute(start.minute())
        .second(start.second())
        .millisecond(start.millisecond())
    const daysInTargetMonth = candidate.daysInMonth()

    if (start.date() > daysInTargetMonth) {
        return null
    }

    return candidate.date(start.date())
}

function expandDailyRecurrence(
    event: CalendarEvent,
    start: dayjs.Dayjs,
    recurrence: NonNullable<CalendarEvent["recurrence"]>,
    rangeStart: number,
    rangeEnd: number,
    calendarTz: string
) {
    const results: CalendarEvent[] = []
    const eventTz = event.timezone || calendarTz
    const durationMs = Math.max(0, dayjs(event.end).valueOf() - dayjs(event.start).valueOf())
    const untilDay = getRecurrenceUntilDay(recurrence, eventTz)
    const exceptionDateKeys = buildExceptionDateKeySet(event, eventTz)
    const rangeStartDay = dayjs(rangeStart).tz(calendarTz).tz(eventTz).startOf("day")
    const diffDays = Math.max(0, rangeStartDay.diff(start.startOf("day"), "day"))
    const stepOffset = Math.max(0, Math.floor(diffDays / recurrence.interval) - 1)
    let occurrence = start.add(stepOffset * recurrence.interval, "day")
    let generated = stepOffset

    while (
        generated < MAX_OCCURRENCES_PER_EVENT &&
        occurrence.valueOf() < rangeEnd + durationMs
    ) {
        if (untilDay && occurrence.isAfter(untilDay, "day")) {
            break
        }

        addOccurrenceIfVisible(
            results,
            event,
            occurrence,
            durationMs,
            exceptionDateKeys,
            rangeStart,
            rangeEnd,
            calendarTz
        )

        generated += 1

        if (recurrence.count && generated >= recurrence.count) {
            break
        }

        occurrence = occurrence.add(recurrence.interval, "day")
    }

    return results
}

function expandWeeklyRecurrence(
    event: CalendarEvent,
    start: dayjs.Dayjs,
    recurrence: NonNullable<CalendarEvent["recurrence"]>,
    rangeStart: number,
    rangeEnd: number,
    calendarTz: string
) {
    const results: CalendarEvent[] = []
    const eventTz = event.timezone || calendarTz
    const durationMs = Math.max(0, dayjs(event.end).valueOf() - dayjs(event.start).valueOf())
    const untilDay = getRecurrenceUntilDay(recurrence, eventTz)
    const exceptionDateKeys = buildExceptionDateKeySet(event, eventTz)
    const byWeekday = Array.from(
        new Set(
            (recurrence.byWeekday?.length ? recurrence.byWeekday : [start.day()])
                .filter((value) => value >= 0 && value <= 6)
                .sort((a, b) => a - b)
        )
    )
    const anchorWeekStart = start.startOf("day").subtract(start.day(), "day")
    const rangeStartWeek = dayjs(rangeStart)
        .tz(calendarTz)
        .tz(eventTz)
        .startOf("day")
        .subtract(dayjs(rangeStart).tz(calendarTz).tz(eventTz).day(), "day")
    const weekDiff = Math.max(0, rangeStartWeek.diff(anchorWeekStart, "week"))
    let weekIndex = Math.max(
        0,
        Math.floor(weekDiff / recurrence.interval) - 1
    )
    let generated = 0

    while (generated < MAX_OCCURRENCES_PER_EVENT) {
        const weekStart = anchorWeekStart.add(
            weekIndex * recurrence.interval,
            "week"
        )

        if (weekStart.valueOf() > rangeEnd + durationMs) {
            break
        }

        for (const weekday of byWeekday) {
            const occurrence = weekStart
                .add(weekday, "day")
                .hour(start.hour())
                .minute(start.minute())
                .second(start.second())
                .millisecond(start.millisecond())

            if (occurrence.isBefore(start)) {
                continue
            }

            if (untilDay && occurrence.isAfter(untilDay, "day")) {
                return results
            }

            addOccurrenceIfVisible(
                results,
                event,
                occurrence,
                durationMs,
                exceptionDateKeys,
                rangeStart,
                rangeEnd,
                calendarTz
            )

            generated += 1

            if (recurrence.count && generated >= recurrence.count) {
                return results
            }

            if (generated >= MAX_OCCURRENCES_PER_EVENT) {
                return results
            }
        }

        weekIndex += 1
    }

    return results
}

function expandMonthlyOrYearlyRecurrence(
    event: CalendarEvent,
    start: dayjs.Dayjs,
    recurrence: NonNullable<CalendarEvent["recurrence"]>,
    rangeStart: number,
    rangeEnd: number,
    calendarTz: string
) {
    const results: CalendarEvent[] = []
    const eventTz = event.timezone || calendarTz
    const durationMs = Math.max(0, dayjs(event.end).valueOf() - dayjs(event.start).valueOf())
    const untilDay = getRecurrenceUntilDay(recurrence, eventTz)
    const exceptionDateKeys = buildExceptionDateKeySet(event, eventTz)
    const unit = recurrence.type === "monthly" ? "month" : "year"
    const rangeLocalStart = dayjs(rangeStart).tz(calendarTz).tz(eventTz)
    const rawOffset =
        unit === "month"
            ? Math.max(0, rangeLocalStart.diff(start, "month"))
            : Math.max(0, rangeLocalStart.diff(start, "year"))
    let step = Math.max(
        0,
        Math.floor(rawOffset / recurrence.interval) - 1
    ) * recurrence.interval
    let generated = 0

    while (generated < MAX_OCCURRENCES_PER_EVENT) {
        const occurrence = buildMonthlyOrYearlyOccurrence(start, unit, step)

        if (occurrence) {
            if (occurrence.valueOf() > rangeEnd + durationMs && results.length > 0) {
                break
            }

            if (untilDay && occurrence.isAfter(untilDay, "day")) {
                break
            }

            addOccurrenceIfVisible(
                results,
                event,
                occurrence,
                durationMs,
                exceptionDateKeys,
                rangeStart,
                rangeEnd,
                calendarTz
            )

            generated += 1

            if (recurrence.count && generated >= recurrence.count) {
                break
            }
        }

        step += recurrence.interval
    }

    return results
}

export function getCalendarEventSourceId(event: CalendarEvent) {
    return event.recurrenceInstance?.sourceEventId ?? event.id
}

export function getCalendarEventRenderId(event: CalendarEvent) {
    return event.recurrenceInstance?.key ?? event.id
}

export function toCalendarEventSource(event: CalendarEvent) {
    if (!event.recurrenceInstance) {
        return event
    }

    return {
        ...event,
        id: event.recurrenceInstance.sourceEventId,
        start: event.recurrenceInstance.sourceStart,
        end: event.recurrenceInstance.sourceEnd,
        recurrenceInstance: undefined,
    }
}

export function getCalendarVisibleEventRange(
    viewport: number,
    calendarTz: string
) {
    const base = dayjs(viewport || Date.now()).tz(calendarTz)

    return {
        start: base
            .subtract(1, "month")
            .startOf("month")
            .startOf("week")
            .startOf("day")
            .valueOf(),
        end: base
            .add(2, "month")
            .endOf("month")
            .endOf("week")
            .startOf("day")
            .valueOf(),
    }
}

export function shiftCalendarEventForDrag(
    event: CalendarEvent,
    dayDelta: number,
    calendarTz: string
) {
    if (!event.recurrence || event.recurrence.type !== "weekly" || dayDelta === 0) {
        return event
    }

    const eventTz = event.timezone || calendarTz
    const fallbackWeekday = dayjs(event.start).tz(eventTz).day()

    return {
        ...event,
        recurrence: {
            ...event.recurrence,
            byWeekday: normalizeRecurrenceWeekdays(
                event.recurrence.byWeekday?.map((weekday) => weekday + dayDelta),
                fallbackWeekday + dayDelta
            ),
        },
    }
}

export function collectCalendarEventDateKeysInRange(
    event: CalendarEvent,
    {
        rangeStart,
        rangeEnd,
        calendarTz,
    }: {
        rangeStart: number
        rangeEnd: number
        calendarTz: string
    }
) {
    const expandedEvents = expandCalendarEventsForRange([event], {
        rangeStart,
        rangeEnd,
        calendarTz,
    })
    const dateKeys = new Set<string>()

    expandedEvents.forEach((expandedEvent) => {
        appendEventDateKeys(dateKeys, expandedEvent, calendarTz)
    })

    return Array.from(dateKeys)
}

export function shiftCalendarDateKeys(
    dateKeys: string[],
    dayDelta: number,
    calendarTz: string
) {
    if (dayDelta === 0 || dateKeys.length === 0) {
        return dateKeys
    }

    return dateKeys.map((dateKey) =>
        dayjs.tz(dateKey, calendarTz).add(dayDelta, "day").format("YYYY-MM-DD")
    )
}

export function expandCalendarEventsForRange(
    events: CalendarEvent[],
    {
        rangeStart,
        rangeEnd,
        calendarTz,
    }: {
        rangeStart: number
        rangeEnd: number
        calendarTz: string
    }
) {
    return events.flatMap((event) => {
        const recurrence = event.recurrence

        if (!recurrence) {
            return doesEventIntersectRange(event, rangeStart, rangeEnd, calendarTz)
                ? [event]
                : []
        }

        const eventTz = event.timezone || calendarTz
        const start = dayjs(event.start).tz(eventTz)

        if (recurrence.count === 0) {
            return []
        }

        switch (recurrence.type) {
            case "daily":
                return expandDailyRecurrence(
                    event,
                    start,
                    recurrence,
                    rangeStart,
                    rangeEnd,
                    calendarTz
                )
            case "weekly":
                return expandWeeklyRecurrence(
                    event,
                    start,
                    recurrence,
                    rangeStart,
                    rangeEnd,
                    calendarTz
                )
            case "monthly":
            case "yearly":
                return expandMonthlyOrYearlyRecurrence(
                    event,
                    start,
                    recurrence,
                    rangeStart,
                    rangeEnd,
                    calendarTz
                )
            default:
                return [event]
        }
    })
}
