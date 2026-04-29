import { koreanPublicHolidaySubscription } from "./providers/korean-public-holidays"
import { koreanSolarTermSubscription } from "./providers/korean-solar-terms"
import type { CalendarSubscription } from "./types"

const calendarSubscriptions: CalendarSubscription[] = [
    koreanPublicHolidaySubscription,
    koreanSolarTermSubscription,
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
