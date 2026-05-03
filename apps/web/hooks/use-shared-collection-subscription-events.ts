"use client"

import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { useCalendarStore } from "@/store/useCalendarStore"
import type {
    CalendarEvent,
    EventSubscriptionItem,
} from "@/store/calendar-store.types"
import {
    calendarEventFromSharedCollectionRow,
    parseSharedCollectionRpcRow,
} from "@/lib/calendar/shared-collection-rpc-row"
import {
    getSubscriptionCatalogTopic,
    isSubscriptionCatalogChangePayload,
    isSubscriptionEventChangePayload,
} from "@/lib/calendar/realtime"
import { useEffect, useMemo, useRef, useState } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"

/**
 * shared_collection 구독의 이벤트를 DB에서 가져와 실시간으로 동기화합니다.
 * Supabase의 구독 카탈로그 전용 채널(subscription:catalog:<id>)을 통해
 * 원본 이벤트 변경 시 자동 갱신합니다.
 */
export function useSharedCollectionSubscriptionEvents(options: {
    rangeStart: number
    rangeEnd: number
    timezone: string
}): CalendarEvent[] {
    const activeCalendarId = useCalendarStore((s) => s.activeCalendar?.id)
    const subscriptionCatalogs = useCalendarStore((s) => s.subscriptionCatalogs)
    const subscriptionState = useCalendarStore((s) => s.subscriptionState)
    const setSubscriptionCatalogs = useCalendarStore(
        (s) => s.setSubscriptionCatalogs
    )

    const [eventsByCatalogId, setEventsByCatalogId] = useState<
        Map<string, CalendarEvent[]>
    >(new Map())

    const installedSharedCatalogs = useMemo(() => {
        const installedSet = new Set(subscriptionState.installedSubscriptionIds)

        return subscriptionCatalogs.filter(
            (c) =>
                c.sourceType === "shared_collection" &&
                installedSet.has(c.id) &&
                c.status === "active"
        )
    }, [subscriptionCatalogs, subscriptionState.installedSubscriptionIds])

    const visibleSharedCatalogIdSet = useMemo(() => {
        const hiddenSet = new Set(subscriptionState.hiddenSubscriptionIds)

        return new Set(
            installedSharedCatalogs
                .filter((catalog) => !hiddenSet.has(catalog.id))
                .map((catalog) => catalog.id)
        )
    }, [installedSharedCatalogs, subscriptionState.hiddenSubscriptionIds])

    const sharedCatalogsRef = useRef(installedSharedCatalogs)
    sharedCatalogsRef.current = installedSharedCatalogs

    const optionsRef = useRef(options)
    optionsRef.current = options

    const activeCalendarIdRef = useRef(activeCalendarId)
    activeCalendarIdRef.current = activeCalendarId

    const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map())

    // 특정 카탈로그의 이벤트 조회
    const fetchForCatalog = async (
        catalogId: string
    ): Promise<CalendarEvent[]> => {
        const calId = activeCalendarIdRef.current
        if (!calId || calId === "demo") return []

        const { rangeStart, rangeEnd } = optionsRef.current
        const supabase = createBrowserSupabase()

        let data: unknown = null
        let error: { code?: string; message?: string } | null = null

        for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt > 0) {
                await new Promise((r) => setTimeout(r, 120 * attempt))
            }

            const result = await supabase.rpc(
                "get_shared_collection_subscription_events",
                {
                    p_catalog_id: catalogId,
                    p_calendar_id: calId,
                    p_range_start: new Date(rangeStart).toISOString(),
                    p_range_end: new Date(rangeEnd).toISOString(),
                }
            )

            error = result.error ?? null
            data = result.data ?? null

            if (!error) {
                break
            }

            const recoverable =
                error.code === "P0001" &&
                typeof error.message === "string" &&
                error.message.includes("subscription not installed")

            if (!recoverable || attempt === 2) {
                break
            }
        }

        if (error || !data) {
            console.error("Failed to fetch shared collection events:", error)
            return []
        }

        const catalog = sharedCatalogsRef.current.find(
            (c) => c.id === catalogId
        )
        const meta: EventSubscriptionItem = {
            id: catalogId,
            name: catalog?.name ?? "",
            sourceType: "shared_collection",
            authority: "user",
            providerName: catalog?.providerName ?? null,
            calendar: catalog?.calendar ?? null,
        }

        if (!Array.isArray(data)) {
            return []
        }

        return data.map((raw) => {
            const parsed = parseSharedCollectionRpcRow(raw)
            const compositeId = `sub:${catalogId}:${parsed.event_id}`
            return calendarEventFromSharedCollectionRow(
                parsed,
                compositeId,
                meta
            )
        })
    }

    // 카탈로그 목록 또는 범위 변경 시 이벤트 재조회 + 실시간 채널 관리
    useEffect(() => {
        if (!activeCalendarId || activeCalendarId === "demo") {
            setEventsByCatalogId(new Map())
            return
        }

        if (installedSharedCatalogs.length === 0) {
            for (const ch of channelsRef.current.values()) {
                void createBrowserSupabase().removeChannel(ch)
            }
            channelsRef.current.clear()
            setEventsByCatalogId(new Map())
            return
        }

        let disposed = false
        const supabase = createBrowserSupabase()

        // 전체 재조회
        const loadAll = async () => {
            if (disposed) return
            const results = await Promise.all(
                sharedCatalogsRef.current.map(async (catalog) => ({
                    catalogId: catalog.id,
                    events: await fetchForCatalog(catalog.id),
                }))
            )
            if (disposed) return
            setEventsByCatalogId((prev) => {
                const nextMap = new Map(prev)

                for (const { catalogId, events } of results) {
                    nextMap.set(catalogId, events)
                }

                for (const existingCatalogId of nextMap.keys()) {
                    if (
                        !sharedCatalogsRef.current.some(
                            (catalog) => catalog.id === existingCatalogId
                        )
                    ) {
                        nextMap.delete(existingCatalogId)
                    }
                }

                return nextMap
            })
        }

        void loadAll()

        // 더 이상 필요 없는 채널 정리
        const nextIds = new Set(installedSharedCatalogs.map((c) => c.id))
        for (const [cid, ch] of channelsRef.current.entries()) {
            if (!nextIds.has(cid)) {
                void supabase.removeChannel(ch)
                channelsRef.current.delete(cid)
            }
        }

        // 신규 카탈로그 채널 구독
        for (const catalog of installedSharedCatalogs) {
            if (channelsRef.current.has(catalog.id)) continue

            const topic = getSubscriptionCatalogTopic(catalog.id)
            const channel = supabase
                .channel(topic)
                .on(
                    "broadcast",
                    { event: "calendar.event.created" },
                    (msg: { payload?: unknown }) => {
                        if (disposed) return
                        if (!isSubscriptionEventChangePayload(msg.payload))
                            return
                        void fetchForCatalog(catalog.id).then((events) => {
                            if (disposed) return
                            setEventsByCatalogId((prev) => {
                                const next = new Map(prev)
                                next.set(catalog.id, events)
                                return next
                            })
                        })
                    }
                )
                .on(
                    "broadcast",
                    { event: "calendar.event.updated" },
                    (msg: { payload?: unknown }) => {
                        if (disposed) return
                        if (!isSubscriptionEventChangePayload(msg.payload))
                            return
                        void fetchForCatalog(catalog.id).then((events) => {
                            if (disposed) return
                            setEventsByCatalogId((prev) => {
                                const next = new Map(prev)
                                next.set(catalog.id, events)
                                return next
                            })
                        })
                    }
                )
                .on(
                    "broadcast",
                    { event: "calendar.event.deleted" },
                    (msg: { payload?: unknown }) => {
                        if (disposed) return
                        if (!isSubscriptionEventChangePayload(msg.payload))
                            return
                        void fetchForCatalog(catalog.id).then((events) => {
                            if (disposed) return
                            setEventsByCatalogId((prev) => {
                                const next = new Map(prev)
                                next.set(catalog.id, events)
                                return next
                            })
                        })
                    }
                )
                .on(
                    "broadcast",
                    { event: "subscription.catalog.updated" },
                    (msg: { payload?: unknown }) => {
                        if (disposed) return
                        const p = msg.payload
                        if (!isSubscriptionCatalogChangePayload(p)) return
                        // 카탈로그가 비활성화/삭제됨 → 이벤트 제거 + store에서 상태 갱신
                        if (!p.isActive || p.status !== "active") {
                            setEventsByCatalogId((prev) => {
                                const next = new Map(prev)
                                next.delete(catalog.id)
                                return next
                            })
                            // 구독 카탈로그 상태 업데이트 (store)
                            const currentCatalogs =
                                useCalendarStore.getState().subscriptionCatalogs
                            setSubscriptionCatalogs(
                                currentCatalogs.map((c) =>
                                    c.id === catalog.id
                                        ? { ...c, status: p.status }
                                        : c
                                )
                            )
                        }
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
        activeCalendarId,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        installedSharedCatalogs.map((c) => c.id).join(","),
        options.rangeStart,
        options.rangeEnd,
    ])

    // 언마운트 시 채널 전체 정리
    useEffect(() => {
        const channels = channelsRef.current

        return () => {
            const supabase = createBrowserSupabase()
            for (const ch of channels.values()) {
                void supabase.removeChannel(ch)
            }
            channels.clear()
        }
    }, [])

    return useMemo(() => {
        const allEvents: CalendarEvent[] = []

        for (const [catalogId, events] of eventsByCatalogId.entries()) {
            if (!visibleSharedCatalogIdSet.has(catalogId)) {
                continue
            }

            allEvents.push(...events)
        }

        return allEvents
    }, [eventsByCatalogId, visibleSharedCatalogIdSet])
}
