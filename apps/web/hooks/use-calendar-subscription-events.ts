"use client"

import { useCalendarSubscriptions } from "@/hooks/use-calendar-subscriptions"
import {
    KOREA_HOLIDAY_SUBSCRIPTION_ID,
    KOREAN_HOLIDAY_PROVIDER_KEY,
    generateKoreanPublicHolidaySubscriptionEvents,
} from "@/lib/calendar/subscriptions/providers/korean-public-holidays"
import {
    KOREA_SOLAR_TERMS_SUBSCRIPTION_ID,
    KOREAN_SOLAR_TERMS_PROVIDER_KEY,
    generateKoreanSolarTermSubscriptionEvents,
} from "@/lib/calendar/subscriptions/providers/korean-solar-terms"
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
            const slug = subscription.slug ?? ""
            const isKoreanHoliday =
                slug === KOREA_HOLIDAY_SUBSCRIPTION_ID ||
                provider === KOREAN_HOLIDAY_PROVIDER_KEY
            const isKoreanSolarTerms =
                slug === KOREA_SOLAR_TERMS_SUBSCRIPTION_ID ||
                provider === KOREAN_SOLAR_TERMS_PROVIDER_KEY

            const attachMeta = (event: CalendarEvent): CalendarEvent => ({
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
                    calendar: subscription.calendar
                        ? {
                              id: subscription.calendar.id,
                              name: subscription.calendar.name,
                              avatarUrl: subscription.calendar.avatarUrl,
                          }
                        : null,
                },
            })

            const context = {
                rangeStart: options.rangeStart,
                rangeEnd: options.rangeEnd,
                timezone: options.timezone,
            }

            if (isKoreanHoliday) {
                merged.push(
                    ...generateKoreanPublicHolidaySubscriptionEvents(context).map(
                        attachMeta
                    )
                )
            } else if (isKoreanSolarTerms) {
                merged.push(
                    ...generateKoreanSolarTermSubscriptionEvents(context).map(
                        attachMeta
                    )
                )
            }
        }

        return merged
    }, [
        options.rangeEnd,
        options.rangeStart,
        options.timezone,
        visibleSubscriptions,
    ])
}
