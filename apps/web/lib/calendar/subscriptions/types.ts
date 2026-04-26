import type {
    CalendarEvent,
    CalendarSubscriptionDefinition,
} from "@/store/calendar-store.types"

export type CalendarSubscriptionGenerateContext = {
    rangeStart: number
    rangeEnd: number
    timezone: string
}

export type CalendarSubscription = CalendarSubscriptionDefinition & {
    generateEvents: (
        context: CalendarSubscriptionGenerateContext
    ) => CalendarEvent[]
}
