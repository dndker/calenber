"use client"

/**
 * Google Calendar 구독 이벤트를 가져와 실시간 동기화하는 훅
 *
 * 동작:
 *   1. source_type='google_calendar'인 설치된 구독 카탈로그를 필터링
 *   2. 각 카탈로그마다 /api/google-calendar/events 호출로 이벤트 조회
 *   3. Supabase Realtime subscription:catalog:<id> 채널에서
 *      google.calendar.events.changed 수신 시 re-fetch
 *   4. 5분 polling fallback (webhook 미도달 대비)
 */

import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { useCalendarStore } from "@/store/useCalendarStore"
import type { CalendarEvent, EventSubscriptionItem } from "@/store/calendar-store.types"
import {
    getSubscriptionCatalogTopic,
} from "@/lib/calendar/realtime"
import {
    makeGoogleCalendarEventId,
    mapGoogleEventToCalendarEvent,
} from "@/lib/google/calendar-event-mapper"
import type { GoogleCalendarEvent } from "@/lib/google/calendar-api"
import { useEffect, useRef, useState } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"

const POLLING_INTERVAL_MS = 5 * 60 * 1000 // 5분

type GoogleCatalogMeta = {
    id: string
    name: string
    collectionColor: string | null | undefined
    googleCalendarId: string
    googleAccountId: string
    googleEmail: string | null
}

type UseGoogleCalendarSubscriptionEventsOptions = {
    rangeStart: number
    rangeEnd: number
    timezone: string
}

/**
 * 클라이언트에서 Google 이벤트를 조회하는 API 호출
 * (토큰 갱신은 서버에서 처리)
 */
async function fetchGoogleEventsForCatalog(
    catalogId: string,
    googleCalendarId: string,
    googleAccountId: string,
    rangeStart: number,
    rangeEnd: number
): Promise<GoogleCalendarEvent[]> {
    const params = new URLSearchParams({
        catalogId,
        googleCalendarId,
        googleAccountId,
        timeMin: new Date(rangeStart).toISOString(),
        timeMax: new Date(rangeEnd).toISOString(),
    })

    const res = await fetch(`/api/google-calendar/events?${params.toString()}`)
    if (!res.ok) return []

    const data = (await res.json()) as { events?: GoogleCalendarEvent[] }
    return data.events ?? []
}

export function useGoogleCalendarSubscriptionEvents(
    options: UseGoogleCalendarSubscriptionEventsOptions
): CalendarEvent[] {
    const subscriptionCatalogs = useCalendarStore((s) => s.subscriptionCatalogs)
    const subscriptionState = useCalendarStore((s) => s.subscriptionState)
    /**
     * Calenber에 저장된 이벤트 중 google_event_id가 있는 것들의 집합.
     * 구글 webhook re-fetch 시 이미 Calenber에 저장된 이벤트는 중복 표시하지 않는다.
     */
    const calenberGoogleEventIds = useCalendarStore((s) => {
        const ids = new Set<string>()
        for (const ev of s.events) {
            if (ev.googleEventId) ids.add(ev.googleEventId)
        }
        return ids
    })
    const calenberGoogleEventIdsRef = useRef(calenberGoogleEventIds)
    calenberGoogleEventIdsRef.current = calenberGoogleEventIds

    const [eventsByCatalogId, setEventsByCatalogId] = useState<Map<string, CalendarEvent[]>>(
        new Map()
    )

    // 설치 + 가시 + google_calendar 타입만 필터
    const googleCatalogs: GoogleCatalogMeta[] = (() => {
        const installedSet = new Set(subscriptionState.installedSubscriptionIds)
        const hiddenSet = new Set(subscriptionState.hiddenSubscriptionIds)

        return subscriptionCatalogs
            .filter(
                (c) =>
                    c.sourceType === "google_calendar" &&
                    installedSet.has(c.id) &&
                    !hiddenSet.has(c.id) &&
                    c.status === "active"
            )
            .map((c) => ({
                id: c.id,
                name: c.name,
                collectionColor: c.collectionColor,
                googleCalendarId: String(c.config?.googleCalendarId ?? ""),
                googleAccountId: String(c.config?.googleAccountId ?? ""),
                googleEmail:
                    typeof c.config?.googleEmail === "string"
                        ? c.config.googleEmail
                        : null,
            }))
            .filter((c) => c.googleCalendarId && c.googleAccountId)
    })()

    const googleCatalogsRef = useRef(googleCatalogs)
    googleCatalogsRef.current = googleCatalogs

    const optionsRef = useRef(options)
    optionsRef.current = options

    const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map())
    const pollingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

    const fetchAndUpdate = async (catalog: GoogleCatalogMeta) => {
        const { rangeStart, rangeEnd } = optionsRef.current
        const googleEvents = await fetchGoogleEventsForCatalog(
            catalog.id,
            catalog.googleCalendarId,
            catalog.googleAccountId,
            rangeStart,
            rangeEnd
        )

        const subscriptionMeta: EventSubscriptionItem = {
            id: catalog.id,
            name: catalog.name,
            sourceType: "google_calendar",
            authority: "user",
            providerName: "Google Calendar",
            calendar: null,
            googleEmail: catalog.googleEmail,
        }

        const calendarEvents: CalendarEvent[] = []
        for (const ge of googleEvents) {
            // Calenber에 이미 저장된 이벤트(google_event_id 일치)는 중복 표시 방지
            if (calenberGoogleEventIdsRef.current.has(ge.id)) continue

            const mapped = mapGoogleEventToCalendarEvent(ge, {
                catalogId: catalog.id,
                catalogName: catalog.name,
                collectionColor: catalog.collectionColor,
                isLocked: false, // 쓰기 권한은 API 응답에서 결정하지만 기본 false
                subscriptionMeta,
            })
            if (mapped) calendarEvents.push(mapped)
        }

        setEventsByCatalogId((prev) => {
            const next = new Map(prev)
            next.set(catalog.id, calendarEvents)
            return next
        })
    }

    // polling 스케줄 (catalog별)
    const schedulePolling = (catalog: GoogleCatalogMeta) => {
        const existing = pollingTimersRef.current.get(catalog.id)
        if (existing) clearTimeout(existing)

        const timer = setTimeout(() => {
            void fetchAndUpdate(catalog).then(() => {
                // 다음 polling 예약
                schedulePolling(catalog)
            })
        }, POLLING_INTERVAL_MS)

        pollingTimersRef.current.set(catalog.id, timer)
    }

    useEffect(() => {
        if (googleCatalogs.length === 0) {
            // 채널 + polling 전체 정리
            const supabase = createBrowserSupabase()
            for (const ch of channelsRef.current.values()) {
                void supabase.removeChannel(ch)
            }
            channelsRef.current.clear()
            for (const t of pollingTimersRef.current.values()) clearTimeout(t)
            pollingTimersRef.current.clear()
            setEventsByCatalogId(new Map())
            return
        }

        let disposed = false
        const supabase = createBrowserSupabase()

        // 초기 전체 fetch
        for (const catalog of googleCatalogs) {
            void fetchAndUpdate(catalog)
        }

        // 더 이상 필요 없는 채널/polling 정리
        const nextIds = new Set(googleCatalogs.map((c) => c.id))
        for (const [cid, ch] of channelsRef.current.entries()) {
            if (!nextIds.has(cid)) {
                void supabase.removeChannel(ch)
                channelsRef.current.delete(cid)
            }
        }
        for (const [cid, t] of pollingTimersRef.current.entries()) {
            if (!nextIds.has(cid)) {
                clearTimeout(t)
                pollingTimersRef.current.delete(cid)
            }
        }

        // 신규 카탈로그 채널 구독 + polling
        for (const catalog of googleCatalogs) {
            // polling
            schedulePolling(catalog)

            if (channelsRef.current.has(catalog.id)) continue

            const topic = getSubscriptionCatalogTopic(catalog.id)
            const channel = supabase
                .channel(topic)
                .on(
                    "broadcast",
                    { event: "google.calendar.events.changed" },
                    () => {
                        if (disposed) return
                        // webhook 수신 → 즉시 re-fetch + polling 재시작
                        void fetchAndUpdate(catalog)
                        schedulePolling(catalog)
                    }
                )
                .subscribe()

            channelsRef.current.set(catalog.id, channel)
        }

        return () => {
            disposed = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        // eslint-disable-next-line react-hooks/exhaustive-deps
        googleCatalogs.map((c) => c.id).join(","),
        options.rangeStart,
        options.rangeEnd,
    ])

    // 언마운트 시 전체 정리
    useEffect(() => {
        return () => {
            const supabase = createBrowserSupabase()
            for (const ch of channelsRef.current.values()) {
                void supabase.removeChannel(ch)
            }
            channelsRef.current.clear()
            for (const t of pollingTimersRef.current.values()) clearTimeout(t)
            pollingTimersRef.current.clear()
        }
    }, [])

    const allEvents: CalendarEvent[] = []
    for (const events of eventsByCatalogId.values()) {
        allEvents.push(...events)
    }
    return allEvents
}
