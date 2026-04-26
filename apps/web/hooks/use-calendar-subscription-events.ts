"use client"

import { useCalendarSubscriptions } from "@/hooks/use-calendar-subscriptions"
import { generateKoreanPublicHolidaySubscriptionEvents } from "@/lib/calendar/subscriptions/providers/korean-public-holidays"
import type { CalendarEvent } from "@/store/calendar-store.types"
import { useMemo } from "react"

type UseCalendarSubscriptionEventsOptions = {
    rangeStart: number
    rangeEnd: number
    timezone: string
}

export function useCalendarSubscriptionEvents(
    options: UseCalendarSubscriptionEventsOptions
) {
    const { visibleSubscriptions } = useCalendarSubscriptions()

    return useMemo(() => {
        const merged: CalendarEvent[] = []

        for (const subscription of visibleSubscriptions) {
            const provider = String(subscription.config?.provider ?? "")
            const isKoreanHoliday =
                subscription.slug === "subscription.kr.public-holidays" ||
                provider === "korean_public_holidays_v1"
            const events = isKoreanHoliday
                ? generateKoreanPublicHolidaySubscriptionEvents({
                      rangeStart: options.rangeStart,
                      rangeEnd: options.rangeEnd,
                      timezone: options.timezone,
                  }).map((event) => ({
                      ...event,
                      subscription: {
                          id: subscription.id,
                          slug: subscription.slug,
                          name: subscription.name,
                          sourceType: subscription.sourceType,
                          authority: subscription.authority,
                          providerName:
                              subscription.providerName ??
                              (subscription.authority === "system"
                                  ? "캘린버"
                                  : null),
                          sourceCalendarId: subscription.sourceCalendarId,
                          sourceCalendarName: subscription.sourceCalendarName,
                      },
                  }))
                : []
            merged.push(...events)
        }

        return merged
    }, [
        options.rangeEnd,
        options.rangeStart,
        options.timezone,
        visibleSubscriptions,
    ])
}
