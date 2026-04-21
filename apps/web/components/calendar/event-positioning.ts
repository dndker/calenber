import { toCalendarRange } from "@/lib/date"
import type { CalendarEvent } from "@/store/calendar-store.types"

export type PositionedCalendarEvent = CalendarEvent & {
    startCal: number
    endCalExclusive: number
}

export function positionCalendarEvents(
    events: CalendarEvent[],
    calendarTz: string
): PositionedCalendarEvent[] {
    return events.map((event) => {
        const { startDay, endDay } = toCalendarRange(event, calendarTz)

        return {
            ...event,
            startCal: startDay.valueOf(),
            endCalExclusive: endDay.add(1, "day").valueOf(),
        }
    })
}
