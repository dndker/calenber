"use client"

import {
    isCalendarEventUuid,
    isGeneratedSubscriptionEventId,
    isGoogleCalendarSubscriptionEventId,
    parseSubscriptionCompositeEventId,
} from "@/lib/calendar/event-id"
import { expandCalendarEventsForRange } from "@/lib/calendar/recurrence"
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
import {
    parseGoogleCalendarEventId,
} from "@/lib/google/calendar-event-mapper"
import type { CalendarEvent } from "@/store/calendar-store.types"
import { useCalendarStore } from "@/store/useCalendarStore"
import { useEffect, useMemo, useState } from "react"
import { useCalendarSubscriptions } from "./use-calendar-subscriptions"

type UseCalendarEventDetailOptions = {
    eventId?: string
    occurrenceStart?: number
    initialEvent?: CalendarEvent | null
}

const EVENT_DETAIL_CACHE_TTL_MS = 30_000
const eventDetailCache = new Map<
    string,
    {
        fetchedAt: number
        event: CalendarEvent | null
    }
>()

function getCachedEventDetail(eventId: string) {
    const cached = eventDetailCache.get(eventId)

    if (!cached) {
        return null
    }

    if (Date.now() - cached.fetchedAt > EVENT_DETAIL_CACHE_TTL_MS) {
        eventDetailCache.delete(eventId)
        return null
    }

    return cached.event
}

function setCachedEventDetail(eventId: string, event: CalendarEvent | null) {
    eventDetailCache.set(eventId, {
        event,
        fetchedAt: Date.now(),
    })
}

export function primeCalendarEventDetail(event: CalendarEvent | null | undefined) {
    if (!event?.id) {
        return
    }

    setCachedEventDetail(event.id, event)
}

export function useCalendarEventDetail({
    eventId,
    occurrenceStart,
    initialEvent = null,
}: UseCalendarEventDetailOptions) {
    const activeCalendarId = useCalendarStore((s) => s.activeCalendar?.id)
    const { visibleSubscriptions } = useCalendarSubscriptions()
    const storeEvent = useCalendarStore((state) =>
        eventId ? state.events.find((event) => event.id === eventId) : undefined
    )
    const viewEvent = useCalendarStore((state) =>
        eventId && state.viewEvent?.id === eventId ? state.viewEvent : null
    )
    const [remoteState, setRemoteState] = useState<{
        eventId?: string
        event: CalendarEvent | null
        status: "idle" | "loading" | "loaded" | "missing"
    }>({
        eventId: initialEvent?.id,
        event: initialEvent,
        status: initialEvent ? "loaded" : "idle",
    })

    const resolvedInitialEvent =
        initialEvent && initialEvent.id === eventId ? initialEvent : null
    const resolvedViewEvent =
        viewEvent && viewEvent.id === eventId ? viewEvent : null
    const resolvedRemoteEvent =
        remoteState.eventId === eventId ? remoteState.event : null
    const resolvedSubscriptionEvent = useMemo(() => {
        if (!eventId || !isGeneratedSubscriptionEventId(eventId)) {
            return null
        }

        const [, isoDate] = eventId.split(":", 3)
        const parsedDay = isoDate
            ? new Date(`${isoDate}T00:00:00+09:00`).getTime()
            : NaN

        if (!Number.isFinite(parsedDay)) {
            return null
        }

        const rangeArgs = {
            rangeStart: parsedDay - 24 * 60 * 60 * 1000,
            rangeEnd: parsedDay + 24 * 60 * 60 * 1000,
            timezone: "Asia/Seoul",
        }

        for (const subscription of visibleSubscriptions) {
            const provider = String(subscription.config?.provider ?? "")
            const slug = subscription.slug ?? ""
            const isKoreanHoliday =
                slug === KOREA_HOLIDAY_SUBSCRIPTION_ID ||
                provider === KOREAN_HOLIDAY_PROVIDER_KEY
            const isKoreanSolarTerms =
                slug === KOREA_SOLAR_TERMS_SUBSCRIPTION_ID ||
                provider === KOREAN_SOLAR_TERMS_PROVIDER_KEY

            if (
                isKoreanHoliday &&
                eventId.startsWith(`${KOREA_HOLIDAY_SUBSCRIPTION_ID}:`)
            ) {
                const candidates =
                    generateKoreanPublicHolidaySubscriptionEvents(rangeArgs)
                const matched = candidates.find(
                    (candidate) => candidate.id === eventId
                )

                if (matched) {
                    return matched
                }
            }

            if (
                isKoreanSolarTerms &&
                eventId.startsWith(`${KOREA_SOLAR_TERMS_SUBSCRIPTION_ID}:`)
            ) {
                const candidates =
                    generateKoreanSolarTermSubscriptionEvents(rangeArgs)
                const matched = candidates.find(
                    (candidate) => candidate.id === eventId
                )

                if (matched) {
                    return matched
                }
            }
        }

        return null
    }, [eventId, visibleSubscriptions])
    const isSubscriptionComposite = Boolean(
        eventId && parseSubscriptionCompositeEventId(eventId)
    )
    const isGoogleSubscriptionEvent = Boolean(
        eventId && isGoogleCalendarSubscriptionEventId(eventId)
    )

    const shouldFetch = Boolean(
        eventId &&
        (isCalendarEventUuid(eventId) ||
            (isSubscriptionComposite &&
                Boolean(activeCalendarId && activeCalendarId !== "demo")) ||
            Boolean(
                isGoogleSubscriptionEvent &&
                    activeCalendarId &&
                    activeCalendarId !== "demo"
            )) &&
        !storeEvent &&
        !resolvedViewEvent &&
        !resolvedInitialEvent
    )

    const baseEvent = useMemo(() => {
        if (occurrenceStart !== undefined) {
            return (
                resolvedViewEvent ??
                storeEvent ??
                resolvedInitialEvent ??
                resolvedRemoteEvent ??
                resolvedSubscriptionEvent ??
                null
            )
        }

        return (
            storeEvent ??
            resolvedViewEvent ??
            resolvedInitialEvent ??
            resolvedRemoteEvent ??
            resolvedSubscriptionEvent ??
            null
        )
    }, [
        occurrenceStart,
        resolvedInitialEvent,
        resolvedRemoteEvent,
        resolvedSubscriptionEvent,
        resolvedViewEvent,
        storeEvent,
    ])
    const event = useMemo(() => {
        if (!baseEvent || occurrenceStart === undefined) {
            return baseEvent
        }

        if (baseEvent.recurrenceInstance?.occurrenceStart === occurrenceStart) {
            return baseEvent
        }

        if (!baseEvent.recurrence) {
            return baseEvent
        }

        const resolved = expandCalendarEventsForRange([baseEvent], {
            rangeStart: occurrenceStart,
            rangeEnd: occurrenceStart + 1,
            calendarTz: baseEvent.timezone || "Asia/Seoul",
        }).find(
            (candidate) =>
                candidate.recurrenceInstance?.occurrenceStart ===
                occurrenceStart
        )

        return resolved ?? baseEvent
    }, [baseEvent, occurrenceStart])

    useEffect(() => {
        let cancelled = false

        if (!eventId || !shouldFetch) {
            return () => {
                cancelled = true
            }
        }

        const alignId = window.setTimeout(() => {
            if (cancelled) {
                return
            }

            setRemoteState((prev) => {
                if (prev.eventId === eventId && prev.status === "loading") {
                    return prev
                }

                return {
                    eventId,
                    event: null,
                    status: "loading",
                }
            })
        }, 0)

        const cachedEvent = getCachedEventDetail(eventId)

        if (cachedEvent) {
            setRemoteState({
                eventId,
                event: cachedEvent,
                status: "loaded",
            })
            useCalendarStore.getState().upsertEventSnapshot(cachedEvent)
            return () => {
                cancelled = true
                clearTimeout(alignId)
            }
        }

        const fetchEvent = async () => {
            if (!activeCalendarId || activeCalendarId === "demo") {
                return null
            }

            const params = new URLSearchParams({
                calendarId: activeCalendarId,
                eventId,
            })
            const response = await fetch(
                `/api/calendar/event-detail?${params.toString()}`
            )

            if (!response.ok) {
                return null
            }

            const data = (await response.json()) as {
                event?: CalendarEvent | null
            }

            return data.event ?? null
        }

        void fetchEvent().then((nextEvent) => {
            if (cancelled) {
                return
            }

            if (!nextEvent) {
                setCachedEventDetail(eventId, null)
                setRemoteState({
                    eventId,
                    event: null,
                    status: "missing",
                })
                return
            }

            setCachedEventDetail(eventId, nextEvent)
            setRemoteState({
                eventId,
                event: nextEvent,
                status: "loaded",
            })
            useCalendarStore.getState().upsertEventSnapshot(nextEvent)
        })

        return () => {
            cancelled = true
            clearTimeout(alignId)
        }
    }, [
        activeCalendarId,
        eventId,
        shouldFetch,
    ])

    const isLoading =
        shouldFetch &&
        (remoteState.eventId !== eventId || remoteState.status === "loading")
    const isMissing =
        shouldFetch &&
        remoteState.eventId === eventId &&
        remoteState.status === "missing"

    return {
        event,
        isLoading,
        isMissing,
    }
}
