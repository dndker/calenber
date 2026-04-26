import { koreanPublicHolidaySubscription } from "./providers/korean-public-holidays"
import type { CalendarSubscription } from "./types"

const calendarSubscriptions: CalendarSubscription[] = [
    koreanPublicHolidaySubscription,
]

export function getCalendarSubscriptions() {
    return calendarSubscriptions
}

export function getCalendarSubscriptionById(subscriptionId: string) {
    return (
        calendarSubscriptions.find(
            (subscription) => subscription.id === subscriptionId
        ) ?? null
    )
}
