"use client"

import { normalizeCalendarEventFieldSettings } from "@/lib/calendar/event-field-settings"
import { normalizeCalendarLayoutOptions } from "@/lib/calendar/layout-options"
import {
    createCalendarEvent,
    deleteCalendarEvent,
    setCalendarEventFavorite,
    setCalendarSubscriptionEventFavorite,
    updateCalendarEvent as updateCalendarEventQuery,
} from "@/lib/calendar/mutations"
import { isCalendarEventUuid } from "@/lib/calendar/event-id"
import {
    canCreateCalendarEvents,
    canDeleteCalendarEvent,
    canEditCalendarEvent,
} from "@/lib/calendar/permissions"
import type { MyCalendarItem } from "@/lib/calendar/queries"
import {
    collectCalendarEventDateKeysInRange,
    getCalendarEventRenderId,
    getCalendarEventSourceId,
    getCalendarVisibleEventRange,
    shiftCalendarDateKeys,
    shiftCalendarEventForDrag,
    toCalendarEventSource,
} from "@/lib/calendar/recurrence"
import dayjs from "@/lib/dayjs"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { toast } from "sonner"
import type {
    CalendarDragState,
    CalendarEvent,
    CalendarEventCollection,
    CalendarEventFilterState,
    CalendarEventPatch,
    CalendarStoreState,
} from "./calendar-store.types"
import { createSSRStore } from "./createSSRStore"
import { useAuthStore } from "./useAuthStore"

const defaultExcludedStatuses: CalendarEventFilterState["excludedStatuses"] = [
    "completed",
    "cancelled",
]

const defaultSubscriptionState: CalendarStoreState["subscriptionState"] = {
    installedSubscriptionIds: [],
    hiddenSubscriptionIds: [],
}

function buildFavoriteEventMap(events: CalendarEvent[]) {
    return Object.fromEntries(
        events
            .filter((event) => event.isFavorite)
            .map((event) => [event.id, event.favoritedAt ?? Date.now()])
    ) as Record<string, number | null>
}

function getPersistableCalendarId() {
    const calendarId = useCalendarStore.getState().activeCalendar?.id

    if (!calendarId || calendarId === "demo") {
        return null
    }

    return calendarId
}

async function persistCreatedEvent(event: CalendarEvent) {
    const calendarId = getPersistableCalendarId()

    if (!calendarId) {
        return
    }

    const supabase = createBrowserSupabase()
    const created = await createCalendarEvent(supabase, calendarId, event)

    if (!created) {
        toast.error("일정 생성 실패")
    }
}

async function persistUpdatedEvent(
    eventId: string,
    patch: CalendarEventPatch,
    options?: {
        expectedUpdatedAt?: number
    }
) {
    const calendarId = getPersistableCalendarId()

    if (!calendarId) {
        return
    }

    const supabase = createBrowserSupabase()
    const result = await updateCalendarEventQuery(
        supabase,
        eventId,
        patch,
        options
    )

    if (!result.ok) {
        if (result.status === "conflict" && result.event) {
            useCalendarStore.getState().upsertEventSnapshot(result.event)
            toast.warning(
                "다른 멤버의 수정과 충돌해 최신 내용으로 갱신했습니다."
            )
            return
        }

        toast.error("일정 수정 실패")
        return
    }

    if (result.event) {
        const currentEvent = useCalendarStore
            .getState()
            .events.find((event) => event.id === result.event?.id)

        if (!currentEvent || result.event.updatedAt >= currentEvent.updatedAt) {
            useCalendarStore.getState().upsertEventSnapshot(result.event)
        }
    }
}

async function persistDeletedEvent(eventId: string) {
    const calendarId = getPersistableCalendarId()

    if (!calendarId) {
        return
    }

    const supabase = createBrowserSupabase()
    const ok = await deleteCalendarEvent(supabase, eventId)

    if (!ok) {
        toast.error("일정 삭제 실패")
    }
}

async function persistEventFavorite(
    eventId: string,
    isFavorite: boolean,
    userId: string
) {
    const calendarId = getPersistableCalendarId()

    if (!calendarId) {
        return {
            ok: true as const,
            favoritedAt: isFavorite ? Date.now() : null,
        }
    }

    const supabase = createBrowserSupabase()

    if (!isCalendarEventUuid(eventId)) {
        return setCalendarSubscriptionEventFavorite(supabase, {
            calendarId,
            eventId,
            userId,
            isFavorite,
        })
    }

    return setCalendarEventFavorite(supabase, {
        eventId,
        userId,
        isFavorite,
    })
}

function sortCalendarEvents(events: CalendarEvent[]) {
    return [...events].sort((a, b) => {
        if (a.start !== b.start) {
            return a.start - b.start
        }

        if (a.createdAt !== b.createdAt) {
            return a.createdAt - b.createdAt
        }

        return a.id.localeCompare(b.id)
    })
}

function sortEventCollections(
    collections: CalendarStoreState["eventCollections"]
) {
    return [...collections].sort((a, b) => {
        const nameCompare = a.name
            .toLowerCase()
            .localeCompare(b.name.toLowerCase())

        if (nameCompare !== 0) {
            return nameCompare
        }

        if (a.createdAt !== b.createdAt) {
            return a.createdAt - b.createdAt
        }

        return a.id.localeCompare(b.id)
    })
}

function replaceCollectionInEvent(
    event: CalendarEvent,
    nextCollection: CalendarEventCollection
) {
    if (!event.collectionIds.includes(nextCollection.id)) {
        return event
    }

    const nextCollections = event.collections.map((collection) =>
        collection.id === nextCollection.id ? nextCollection : collection
    )

    return {
        ...event,
        collections: nextCollections,
        primaryCollection: nextCollections[0] ?? null,
        primaryCollectionId: nextCollections[0]?.id ?? null,
        collectionIds: nextCollections.map((collection) => collection.id),
    }
}

function removeCollectionFromEvent(
    event: CalendarEvent,
    collectionId: string
) {
    if (!event.collectionIds.includes(collectionId)) {
        return event
    }

    const nextCollections = event.collections.filter(
        (collection) => collection.id !== collectionId
    )

    return {
        ...event,
        collections: nextCollections,
        primaryCollection: nextCollections[0] ?? null,
        primaryCollectionId: nextCollections[0]?.id ?? null,
        collectionIds: nextCollections.map((collection) => collection.id),
    }
}

function toggleStringFilterItem(items: string[], value: string) {
    return items.includes(value)
        ? items.filter((item) => item !== value)
        : [...items, value]
}

function areRecurrenceValuesEqual(
    left: CalendarEvent["recurrence"] | null | undefined,
    right: CalendarEvent["recurrence"] | null | undefined
) {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

function pruneEventFilters(
    filters: CalendarEventFilterState,
    collections: CalendarStoreState["eventCollections"]
) {
    if (filters.excludedCollectionIds.length === 0) {
        return filters
    }

    const availableCollectionIds = new Set(
        collections.map((collection) => collection.id)
    )
    const excludedCollectionIdsStillValid =
        filters.excludedCollectionIds.filter((id) =>
            availableCollectionIds.has(id)
        )

    if (
        excludedCollectionIdsStillValid.length ===
        filters.excludedCollectionIds.length
    ) {
        return filters
    }

    return {
        ...filters,
        excludedCollectionIds: excludedCollectionIdsStillValid,
    }
}

function syncEventFiltersWithCollectionDefaults(
    filters: CalendarEventFilterState,
    nextCollection: CalendarEventCollection,
    previousCollection?: CalendarEventCollection
) {
    if (
        previousCollection &&
        previousCollection.options.visibleByDefault ===
            nextCollection.options.visibleByDefault
    ) {
        return filters
    }

    return {
        ...filters,
        excludedCollectionIds: nextCollection.options.visibleByDefault
            ? filters.excludedCollectionIds.filter(
                  (id) => id !== nextCollection.id
              )
            : Array.from(
                  new Set([
                      ...filters.excludedCollectionIds,
                      nextCollection.id,
                  ])
              ),
    }
}

function deriveEventCollections(
    collections: CalendarEvent["collections"] | undefined,
    fallbackCollections: CalendarStoreState["eventCollections"] = []
) {
    const resolvedCollections = collections ?? []
    const collectionIds = resolvedCollections.map((collection) => collection.id)
    const primaryCollectionId = collectionIds[0] ?? null
    const primaryCollection =
        resolvedCollections[0] ??
        (primaryCollectionId
            ? (fallbackCollections.find(
                  (collection) => collection.id === primaryCollectionId
              ) ?? null)
            : null)

    return {
        collectionIds,
        collections: resolvedCollections,
        primaryCollectionId,
        primaryCollection,
    }
}

function isSameWorkspaceCursor(
    prev: CalendarStoreState["workspaceCursor"],
    next: CalendarStoreState["workspaceCursor"]
) {
    if (prev === next) {
        return true
    }

    if (!prev || !next) {
        return false
    }

    return (
        prev.type === next.type &&
        prev.date === next.date &&
        prev.eventId === next.eventId
    )
}

function isSameWorkspacePresence(
    prev: CalendarStoreState["workspacePresence"],
    next: CalendarStoreState["workspacePresence"]
) {
    if (prev === next) {
        return true
    }

    if (prev.length !== next.length) {
        return false
    }

    return prev.every((member, index) => {
        const target = next[index]

        if (!target) {
            return false
        }

        return (
            member.id === target.id &&
            member.userId === target.userId &&
            member.displayName === target.displayName &&
            member.avatarUrl === target.avatarUrl &&
            member.isAnonymous === target.isAnonymous &&
            isSameWorkspaceCursor(member.cursor ?? null, target.cursor ?? null)
        )
    })
}

export const useCalendarStore = createSSRStore<
    CalendarStoreState & CalendarDragState
>((set, get) => ({
    myCalendars: [],
    activeCalendar: null,
    activeCalendarMembership: {
        isMember: false,
        role: null,
        status: null,
    },
    favoriteEventMap: {},
    isCalendarLoading: true,
    calendarTimezone: "Asia/Seoul",
    activeEventId: undefined,
    viewEvent: null,
    eventLayout: "compact",

    // 캘린더 레이아웃
    selectedDate: 0,
    viewport: 0,
    viewportMini: 0,
    moveRange: null,
    isWorkspacePresenceLoading: false,
    workspaceCursor: null,
    workspacePresence: [],
    eventCollections: [],
    eventFilters: {
        excludedStatuses: defaultExcludedStatuses,
        excludedCollectionIds: [],
        excludedWithoutCollection: false,
    },
    subscriptionCatalogs: [],
    subscriptionState: defaultSubscriptionState,
    hoveredSeriesEventId: null,

    setMyCalendars: (myCalendars) =>
        set({
            myCalendars: myCalendars.map((calendar) => ({
                ...calendar,
                eventFieldSettings: normalizeCalendarEventFieldSettings(
                    calendar.eventFieldSettings
                ),
                layoutOptions: normalizeCalendarLayoutOptions(
                    calendar.layoutOptions
                ),
            })),
        }),
    setActiveCalendar: (activeCalendar) =>
        set({
            activeCalendar: activeCalendar
                ? {
                      ...activeCalendar,
                      eventFieldSettings: normalizeCalendarEventFieldSettings(
                          activeCalendar.eventFieldSettings
                      ),
                      layoutOptions: normalizeCalendarLayoutOptions(
                          activeCalendar.layoutOptions
                      ),
                  }
                : null,
        }),
    setActiveCalendarMembership: (activeCalendarMembership) =>
        set({ activeCalendarMembership }),
    applyActiveCalendarMembership: (membership) =>
        set((state) => {
            const activeCalendar = state.activeCalendar

            if (
                !activeCalendar ||
                activeCalendar.id === "demo" ||
                !membership.isMember
            ) {
                return {
                    activeCalendarMembership: membership,
                }
            }

            const nextCalendar: MyCalendarItem = {
                ...activeCalendar,
                role: membership.role,
            }
            const existingIndex = state.myCalendars.findIndex(
                (calendar) => calendar.id === activeCalendar.id
            )

            if (existingIndex >= 0) {
                return {
                    activeCalendarMembership: membership,
                    myCalendars: state.myCalendars.map((calendar) =>
                        calendar.id === activeCalendar.id
                            ? { ...calendar, role: membership.role }
                            : calendar
                    ),
                }
            }

            return {
                activeCalendarMembership: membership,
                myCalendars: [nextCalendar, ...state.myCalendars],
            }
        }),
    clearActiveCalendarContext: () =>
        set({
            activeCalendar: null,
            activeCalendarMembership: {
                isMember: false,
                role: null,
                status: null,
            },
            eventLayout: "compact",
            isWorkspacePresenceLoading: false,
            workspaceCursor: null,
            workspacePresence: [],
            eventCollections: [],
            favoriteEventMap: {},
            eventFilters: {
                excludedStatuses: defaultExcludedStatuses,
                excludedCollectionIds: [],
                excludedWithoutCollection: false,
            },
            subscriptionCatalogs: [],
            subscriptionState: defaultSubscriptionState,
            hoveredSeriesEventId: null,
        }),
    updateCalendarSnapshot: (calendarId, patch) =>
        set((s) => {
            const normalizedPatch =
                {
                    ...patch,
                    ...(patch.eventFieldSettings !== undefined
                        ? {
                              eventFieldSettings:
                                  normalizeCalendarEventFieldSettings(
                                      patch.eventFieldSettings
                                  ),
                          }
                        : {}),
                    ...(patch.layoutOptions !== undefined
                        ? {
                              layoutOptions: normalizeCalendarLayoutOptions(
                                  patch.layoutOptions
                              ),
                          }
                        : {}),
                }
            // 이전 구현은 Object.is로 패치 키만 비교해, activeCalendar와
            // myCalendars의 동일 캘린더 행이 어긋난 경우 한쪽만 갱신되어
            // 설정 저장 후 UI/사이드바가 갱신되지 않는 문제가 있었다.
            // calendarId에 해당하는 항목은 항상 같은 패치로 병합한다.
            const nextMyCalendars = s.myCalendars.map((calendar) =>
                calendar.id === calendarId
                    ? { ...calendar, ...normalizedPatch }
                    : calendar
            )
            const nextActiveCalendar =
                s.activeCalendar?.id === calendarId
                    ? { ...s.activeCalendar, ...normalizedPatch }
                    : s.activeCalendar

            return {
                myCalendars: nextMyCalendars,
                activeCalendar: nextActiveCalendar,
            }
        }),

    setCalendarTimezone: (tz: string) => set({ calendarTimezone: tz }),
    setIsWorkspacePresenceLoading: (isWorkspacePresenceLoading) =>
        set({ isWorkspacePresenceLoading }),
    setWorkspaceCursor: (workspaceCursor) =>
        set((state) =>
            isSameWorkspaceCursor(state.workspaceCursor, workspaceCursor)
                ? state
                : { workspaceCursor }
        ),
    setWorkspacePresence: (workspacePresence) =>
        set((state) =>
            isSameWorkspacePresence(state.workspacePresence, workspacePresence)
                ? state
                : { workspacePresence }
        ),
    setEventCollections: (eventCollections) =>
        set((state) => {
            const sortedCollections = sortEventCollections(eventCollections)

            return {
                eventCollections: sortedCollections,
                eventFilters: pruneEventFilters(
                    state.eventFilters,
                    sortedCollections
                ),
            }
        }),
    toggleEventStatusFilter: (status) =>
        set((state) => ({
            eventFilters: {
                ...state.eventFilters,
                excludedStatuses: toggleStringFilterItem(
                    state.eventFilters.excludedStatuses,
                    status
                ) as CalendarEventFilterState["excludedStatuses"],
            },
        })),
    toggleEventCollectionFilter: (collectionId) =>
        set((state) => ({
            eventFilters: {
                ...state.eventFilters,
                excludedCollectionIds: toggleStringFilterItem(
                    state.eventFilters.excludedCollectionIds,
                    collectionId
                ),
            },
        })),
    setExcludedWithoutCollectionFilter: (excluded) =>
        set((state) => ({
            eventFilters: {
                ...state.eventFilters,
                excludedWithoutCollection: excluded,
            },
        })),
    setSubscriptionCatalogs: (subscriptionCatalogs) =>
        set({
            subscriptionCatalogs,
        }),
    setSubscriptionState: (subscriptionState) => set({ subscriptionState }),
    installSubscription: (subscriptionId) =>
        set((state) => {
            if (
                state.subscriptionState.installedSubscriptionIds.includes(
                    subscriptionId
                )
            ) {
                return state
            }

            return {
                subscriptionState: {
                    installedSubscriptionIds: [
                        ...state.subscriptionState.installedSubscriptionIds,
                        subscriptionId,
                    ],
                    hiddenSubscriptionIds:
                        state.subscriptionState.hiddenSubscriptionIds.filter(
                            (id) => id !== subscriptionId
                        ),
                },
            }
        }),
    uninstallSubscription: (subscriptionId) =>
        set((state) => {
            if (
                !state.subscriptionState.installedSubscriptionIds.includes(
                    subscriptionId
                )
            ) {
                return state
            }

            return {
                subscriptionState: {
                    installedSubscriptionIds:
                        state.subscriptionState.installedSubscriptionIds.filter(
                            (id) => id !== subscriptionId
                        ),
                    hiddenSubscriptionIds:
                        state.subscriptionState.hiddenSubscriptionIds.filter(
                            (id) => id !== subscriptionId
                        ),
                },
            }
        }),
    toggleSubscriptionVisibility: (subscriptionId) =>
        set((state) => {
            if (
                !state.subscriptionState.installedSubscriptionIds.includes(
                    subscriptionId
                )
            ) {
                return state
            }

            const hiddenSubscriptionIds =
                state.subscriptionState.hiddenSubscriptionIds.includes(
                    subscriptionId
                )
                    ? state.subscriptionState.hiddenSubscriptionIds.filter(
                          (id) => id !== subscriptionId
                      )
                    : [
                          ...state.subscriptionState.hiddenSubscriptionIds,
                          subscriptionId,
                      ]

            return {
                subscriptionState: {
                    ...state.subscriptionState,
                    hiddenSubscriptionIds,
                },
            }
        }),
    resetEventFilters: () =>
        set((state) => {
            if (
                state.eventFilters.excludedStatuses.length ===
                    defaultExcludedStatuses.length &&
                state.eventFilters.excludedStatuses.every(
                    (status, index) => status === defaultExcludedStatuses[index]
                ) &&
                state.eventFilters.excludedCollectionIds.length === 0 &&
                !state.eventFilters.excludedWithoutCollection
            ) {
                return state
            }

            return {
                eventFilters: {
                    excludedStatuses: defaultExcludedStatuses,
                    excludedCollectionIds: [],
                    excludedWithoutCollection: false,
                },
            }
        }),
    setHoveredSeriesEventId: (eventId) =>
        set((state) => {
            if (state.hoveredSeriesEventId === eventId) {
                return state
            }

            return {
                hoveredSeriesEventId: eventId,
            }
        }),
    upsertEventCollectionSnapshot: (collection) =>
        set((state) => {
            const previousCollection =
                state.eventCollections.find((item) => item.id === collection.id) ??
                undefined
            const nextCollections = previousCollection
                ? state.eventCollections.map((item) =>
                      item.id === collection.id ? { ...item, ...collection } : item
                  )
                : [...state.eventCollections, collection]

            return {
                eventCollections: sortEventCollections(nextCollections),
                eventFilters: pruneEventFilters(
                    syncEventFiltersWithCollectionDefaults(
                        state.eventFilters,
                        collection,
                        previousCollection
                    ),
                    nextCollections
                ),
                events: sortCalendarEvents(
                    state.events.map((event) =>
                        replaceCollectionInEvent(event, collection)
                    )
                ),
                viewEvent: state.viewEvent
                    ? replaceCollectionInEvent(state.viewEvent, collection)
                    : null,
            }
        }),
    removeEventCollectionSnapshot: (collectionId) =>
        set((state) => {
            const nextCollections = state.eventCollections.filter(
                (collection) => collection.id !== collectionId
            )

            return {
                eventCollections: nextCollections,
                eventFilters: {
                    ...state.eventFilters,
                    excludedCollectionIds:
                        state.eventFilters.excludedCollectionIds.filter(
                            (id) => id !== collectionId
                        ),
                },
                events: sortCalendarEvents(
                    state.events.map((event) =>
                        removeCollectionFromEvent(event, collectionId)
                    )
                ),
                viewEvent: state.viewEvent
                    ? removeCollectionFromEvent(state.viewEvent, collectionId)
                    : null,
            }
        }),
    setEventCollectionDefaultVisibility: (collectionId, visibleByDefault) =>
        set((state) => {
            const nextCollections = state.eventCollections.map((collection) =>
                collection.id === collectionId
                    ? {
                          ...collection,
                          options: {
                              ...collection.options,
                              visibleByDefault,
                          },
                      }
                    : collection
            )

            const nextExcludedCollectionIds = visibleByDefault
                ? state.eventFilters.excludedCollectionIds.filter(
                      (id) => id !== collectionId
                  )
                : Array.from(
                      new Set([
                          ...state.eventFilters.excludedCollectionIds,
                          collectionId,
                      ])
                  )

            return {
                eventCollections: sortEventCollections(nextCollections),
                eventFilters: {
                    ...state.eventFilters,
                    excludedCollectionIds: nextExcludedCollectionIds,
                },
            }
        }),

    setIsCalendarLoading: (value) =>
        set({
            isCalendarLoading: value,
        }),
    setActiveEventId: (eventId) =>
        set({
            activeEventId: eventId,
        }),
    setViewEvent: (viewEvent) =>
        set((state) =>
            state.viewEvent === viewEvent
                ? state
                : {
                      viewEvent,
                  }
        ),
    setEventLayout: (layout) =>
        set({
            eventLayout: layout,
        }),
    setSelectedDate: (date) =>
        set((s) => ({
            selectedDate: dayjs
                .tz(date, s.calendarTimezone)
                .startOf("day")
                .valueOf(),
        })),

    setViewportDate: (date) =>
        set((s) => ({
            viewport: dayjs
                .tz(date, s.calendarTimezone)
                .startOf("month")
                .valueOf(),
        })),

    setViewportMiniDate: (date) =>
        set((s) => ({
            viewportMini: dayjs
                .tz(date, s.calendarTimezone)
                .startOf("month")
                .valueOf(),
        })),

    // 일정 레이아웃
    events: [],

    selection: {
        isSelecting: false,
        anchor: null,
        start: null,
        end: null,
    },

    drag: {
        eventId: null,
        renderId: null,
        mode: null,
        originStart: 0,
        originEnd: 0,
        sourceOriginStart: 0,
        sourceOriginEnd: 0,
        start: 0,
        end: 0,
        offset: 0,
        segmentOffset: 0,
        resizePinnedLane: null,
        resizeLayoutWeekStart: null,
        resizeActiveEdge: null,
        previewEvent: null,
        baseHoveredDateKeys: [],
        hoveredDateKeys: [],
    },

    setEvents: (events) =>
        set({
            events: sortCalendarEvents(events),
            favoriteEventMap: buildFavoriteEventMap(events),
        }),
    upsertEventSnapshot: (event) =>
        set((state) => {
            const nextCollections = event.collections.reduce(
                (collections, incomingCollection) => {
                    const existing = collections.find(
                        (item) => item.id === incomingCollection.id
                    )

                    return existing
                        ? collections.map((item) =>
                              item.id === incomingCollection.id
                                  ? { ...item, ...incomingCollection }
                                  : item
                          )
                        : [...collections, incomingCollection]
                },
                state.eventCollections
            )
            const nextEvents = state.events.some((item) => item.id === event.id)
                ? state.events.map((item) =>
                      item.id === event.id ? { ...item, ...event } : item
                  )
                : [...state.events, event]

            return {
                eventCollections: sortEventCollections(nextCollections),
                favoriteEventMap: event.isFavorite
                    ? {
                          ...state.favoriteEventMap,
                          [event.id]: event.favoritedAt ?? Date.now(),
                      }
                    : (() => {
                          const nextFavoriteEventMap = {
                              ...state.favoriteEventMap,
                          }

                          delete nextFavoriteEventMap[event.id]
                          return nextFavoriteEventMap
                      })(),
                eventFilters: pruneEventFilters(
                    nextCollections.reduce(
                        (filters, collection) =>
                            syncEventFiltersWithCollectionDefaults(
                                filters,
                                collection,
                                state.eventCollections.find(
                                    (item) => item.id === collection.id
                                )
                            ),
                        state.eventFilters
                    ),
                    nextCollections
                ),
                events: sortCalendarEvents(nextEvents),
                viewEvent:
                    state.viewEvent?.id === event.id ? event : state.viewEvent,
            }
        }),
    toggleEventFavorite: async (id, nextValue) => {
        const state = get()
        const currentUser = useAuthStore.getState().user
        const currentUserId = currentUser?.id ?? null

        if (!currentUserId) {
            return false
        }

        if (
            state.activeCalendar?.id !== "demo" &&
            !state.activeCalendarMembership.isMember
        ) {
            toast.error("캘린더 멤버만 즐겨찾기를 사용할 수 있습니다.")
            return false
        }

        const previousFavoritedAt = state.favoriteEventMap[id] ?? null
        const previousIsFavorite = id in state.favoriteEventMap
        const resolvedNextValue = nextValue ?? !previousIsFavorite
        const optimisticFavoritedAt = resolvedNextValue ? Date.now() : null

        set((currentState) => {
            const nextFavoriteEventMap = { ...currentState.favoriteEventMap }

            if (resolvedNextValue) {
                nextFavoriteEventMap[id] = optimisticFavoritedAt
            } else {
                delete nextFavoriteEventMap[id]
            }

            return {
                favoriteEventMap: nextFavoriteEventMap,
            }
        })

        if (state.activeCalendar?.id === "demo") {
            return true
        }

        const result = await persistEventFavorite(
            id,
            resolvedNextValue,
            currentUserId
        )

        if (!result.ok) {
            set((currentState) => {
                const nextFavoriteEventMap = { ...currentState.favoriteEventMap }

                if (previousIsFavorite) {
                    nextFavoriteEventMap[id] = previousFavoritedAt
                } else {
                    delete nextFavoriteEventMap[id]
                }

                return {
                    favoriteEventMap: nextFavoriteEventMap,
                }
            })

            toast.error("즐겨찾기를 저장하지 못했습니다.")
            return false
        }

        if (resolvedNextValue && result.favoritedAt !== null) {
            set((currentState) => ({
                favoriteEventMap: {
                    ...currentState.favoriteEventMap,
                    [id]: result.favoritedAt,
                },
            }))
        }

        return true
    },
    removeEventSnapshot: (id) =>
        set((state) => {
            const nextFavoriteEventMap = { ...state.favoriteEventMap }
            delete nextFavoriteEventMap[id]

            return {
                events: state.events.filter((event) => event.id !== id),
                favoriteEventMap: nextFavoriteEventMap,
                activeEventId:
                    state.activeEventId === id ? undefined : state.activeEventId,
            }
        }),
    createEvent: (data) => {
        const { activeCalendar, activeCalendarMembership } = get()

        if (
            activeCalendar?.id !== "demo" &&
            !canCreateCalendarEvents(activeCalendarMembership)
        ) {
            toast.error("이 캘린더에서는 일정을 생성할 수 없습니다.")
            return null
        }

        const now = Date.now()
        const currentUser = useAuthStore.getState().user
        const currentUserId = currentUser?.id ?? null
        const eventId =
            "id" in data && typeof data.id === "string" && data.id
                ? data.id
                : crypto.randomUUID()
        const createdAt =
            "createdAt" in data && typeof data.createdAt === "number"
                ? data.createdAt
                : now
        const updatedAt =
            "updatedAt" in data && typeof data.updatedAt === "number"
                ? data.updatedAt
                : now

        const event: CalendarEvent = {
            id: eventId,
            ...data,
            allDay: data.allDay ?? false,
            ...deriveEventCollections(data.collections, get().eventCollections),
            collections: data.collections ?? [],
            participants: data.participants ?? [],
            isFavorite: data.isFavorite ?? false,
            favoritedAt: data.favoritedAt ?? null,
            status: data.status ?? "scheduled",
            authorId: data.authorId ?? currentUserId,
            author: data.author ?? {
                id: currentUser?.id ?? null,
                name: currentUser?.name ?? null,
                email: currentUser?.email ?? null,
                avatarUrl: currentUser?.avatarUrl ?? null,
            },
            updatedById: currentUserId,
            updatedBy: {
                id: currentUser?.id ?? null,
                name: currentUser?.name ?? null,
                email: currentUser?.email ?? null,
                avatarUrl: currentUser?.avatarUrl ?? null,
            },
            isLocked: data.isLocked ?? false,
            createdAt,
            updatedAt,
        }

        set((s) => ({
            events: sortCalendarEvents([...s.events, event]),
            favoriteEventMap: event.isFavorite
                ? {
                      ...s.favoriteEventMap,
                      [event.id]: event.favoritedAt ?? Date.now(),
                  }
                : s.favoriteEventMap,
            selection: {
                isSelecting: false,
                anchor: null,
                start: null,
                end: null,
            },
        }))

        void persistCreatedEvent(event)

        return event.id
    },

    updateEvent: (id, patch: CalendarEventPatch, options) => {
        const state = get()
        const currentUser = useAuthStore.getState().user
        const currentUserId = currentUser?.id ?? null
        const event = state.events.find((item) => item.id === id)

        if (!event) {
            return false
        }

        if (
            state.activeCalendar?.id !== "demo" &&
            !canEditCalendarEvent(
                event,
                state.activeCalendarMembership,
                currentUserId
            )
        ) {
            toast.error("이 일정은 수정할 수 없습니다.")
            return false
        }

        set((s) => ({
            events: sortCalendarEvents(
                s.events.map((e) =>
                    e.id === id
                        ? {
                              ...e,
                              ...patch,
                              collectionIds:
                                  patch.collectionIds !== undefined
                                      ? patch.collectionIds
                                      : patch.collections !== undefined
                                        ? patch.collections
                                              .map((collection) => collection.id)
                                              .filter(Boolean)
                                        : e.collectionIds,
                              collections:
                                  patch.collections !== undefined
                                      ? patch.collections
                                      : patch.collectionIds !== undefined
                                        ? s.eventCollections.filter((collection) =>
                                              patch.collectionIds?.includes(
                                                  collection.id
                                              )
                                          )
                                        : e.collections,
                              primaryCollectionId:
                                  patch.primaryCollectionId !== undefined
                                      ? patch.primaryCollectionId
                                      : patch.primaryCollection !== undefined
                                        ? patch.primaryCollection?.id || null
                                        : patch.collectionIds !== undefined
                                          ? (patch.collectionIds[0] ?? null)
                                          : patch.collections !== undefined
                                            ? patch.collections[0]?.id || null
                                            : e.primaryCollectionId,
                              primaryCollection:
                                  patch.primaryCollection !== undefined
                                      ? patch.primaryCollection
                                      : patch.collections !== undefined
                                        ? (patch.collections[0] ?? null)
                                        : patch.collectionIds !== undefined
                                          ? (s.eventCollections.find(
                                                (collection) =>
                                                    collection.id ===
                                                    patch.collectionIds?.[0]
                                            ) ?? null)
                                          : patch.primaryCollectionId !== undefined
                                            ? (s.eventCollections.find(
                                                  (collection) =>
                                                      collection.id ===
                                                      patch.primaryCollectionId
                                              ) ?? null)
                                            : e.primaryCollection,
                              recurrence:
                                  patch.recurrence !== undefined
                                      ? (patch.recurrence ?? undefined)
                                      : e.recurrence,
                              updatedAt: Date.now(),
                              updatedById: currentUserId,
                              updatedBy: {
                                  id: currentUser?.id ?? null,
                                  name: currentUser?.name ?? null,
                                  email: currentUser?.email ?? null,
                                  avatarUrl: currentUser?.avatarUrl ?? null,
                              },
                          }
                        : e
                )
            ),
        }))

        void persistUpdatedEvent(id, patch, {
            expectedUpdatedAt: options?.expectedUpdatedAt ?? event.updatedAt,
        })
        return true
    },

    deleteEvent: (id) => {
        const state = get()
        const currentUserId = useAuthStore.getState().user?.id ?? null
        const event = state.events.find((item) => item.id === id)

        if (!event) {
            return false
        }

        if (
            state.activeCalendar?.id !== "demo" &&
            !canDeleteCalendarEvent(
                event,
                state.activeCalendarMembership,
                currentUserId
            )
        ) {
            toast.error("이 일정은 삭제할 수 없습니다.")
            return false
        }

        set((s) => ({
            events: s.events.filter((e) => e.id !== id),
            favoriteEventMap: (() => {
                const nextFavoriteEventMap = { ...s.favoriteEventMap }
                delete nextFavoriteEventMap[id]
                return nextFavoriteEventMap
            })(),
        }))

        void persistDeletedEvent(id)
        return true
    },

    startDrag(event, mode, offset, options) {
        const { calendarTimezone, viewport } = get()
        const sourceEventId = getCalendarEventSourceId(event)
        const sourceStart = event.recurrenceInstance?.sourceStart ?? event.start
        const sourceEnd = event.recurrenceInstance?.sourceEnd ?? event.end
        const sourceEvent = toCalendarEventSource(event)
        const visibleRange = getCalendarVisibleEventRange(
            viewport || Date.now(),
            calendarTimezone
        )
        const baseHoveredDateKeys = collectCalendarEventDateKeysInRange(
            sourceEvent,
            {
                rangeStart: visibleRange.start,
                rangeEnd: visibleRange.end,
                calendarTz: calendarTimezone,
            }
        )

        const isResize = mode === "resize-start" || mode === "resize-end"

        set({
            drag: {
                eventId: sourceEventId,
                renderId: getCalendarEventRenderId(event),
                mode,
                originStart: event.start,
                originEnd: event.end,
                sourceOriginStart: sourceStart,
                sourceOriginEnd: sourceEnd,
                start: event.start,
                end: event.end,
                offset,
                segmentOffset: options?.segmentOffset ?? 0,
                resizePinnedLane: isResize
                    ? (options?.resizePinnedLane ?? null)
                    : null,
                resizeLayoutWeekStart: isResize
                    ? (options?.resizeLayoutWeekStart ?? null)
                    : null,
                resizeActiveEdge: isResize
                    ? mode === "resize-start"
                        ? "start"
                        : "end"
                    : null,
                previewEvent: event,
                baseHoveredDateKeys,
                hoveredDateKeys: mode === "move" ? baseHoveredDateKeys : [],
            },
        })
    },

    moveDrag(date) {
        const { drag, calendarTimezone } = get()
        if (!drag.eventId) return

        // 그리드/이벤트는 calendarTimezone 기준 날짜인데, 로컬 startOf를 쓰면 셀 ms가 하루 단위로 밀려
        // 리사이즈 시 반대쪽 끝(특히 종료일)이 픽셀 단위로 흔들리는 원인이 된다.
        const normalized = dayjs(date).tz(calendarTimezone).startOf("day")

        const duration = dayjs(drag.originEnd)
            .tz(calendarTimezone)
            .startOf("day")
            .diff(
                dayjs(drag.originStart).tz(calendarTimezone).startOf("day"),
                "day"
            )

        if (drag.mode === "move") {
            const newStart = normalized.subtract(drag.offset, "day")
            const nextStart = newStart.valueOf()
            const nextEnd = newStart.add(duration, "day").valueOf()
            const dayDelta = newStart.diff(
                dayjs(drag.originStart).tz(calendarTimezone).startOf("day"),
                "day"
            )

            if (drag.start === nextStart && drag.end === nextEnd) {
                return
            }

            set({
                drag: {
                    ...drag,
                    start: nextStart,
                    end: nextEnd,
                    hoveredDateKeys: shiftCalendarDateKeys(
                        drag.baseHoveredDateKeys,
                        dayDelta,
                        calendarTimezone
                    ),
                },
            })
        }

        if (drag.mode === "resize-start") {
            const nextStart = normalized.valueOf()
            // 하루 길이(start === end)는 허용하고, 역전(start > end)만 막는다.
            if (nextStart > drag.end || nextStart === drag.start) return
            set({
                drag: { ...drag, start: nextStart },
            })
        }

        if (drag.mode === "resize-end") {
            const nextEnd = normalized.valueOf()
            // 하루 길이(start === end)는 허용하고, 역전(end < start)만 막는다.
            if (nextEnd < drag.start || nextEnd === drag.end) return
            set({
                drag: { ...drag, end: nextEnd },
            })
        }
    },

    endDrag() {
        const { drag, updateEvent, calendarTimezone, events } = get()
        if (!drag.eventId) return

        const dayDelta = dayjs(drag.start)
            .tz(calendarTimezone)
            .startOf("day")
            .diff(
                dayjs(drag.originStart).tz(calendarTimezone).startOf("day"),
                "day"
            )
        const patch: CalendarEventPatch = {
            start: drag.sourceOriginStart + (drag.start - drag.originStart),
            end: drag.sourceOriginEnd + (drag.end - drag.originEnd),
        }

        if (!drag.previewEvent?.allDay && patch.start === patch.end) {
            const eventTz = drag.previewEvent?.timezone || calendarTimezone
            const startAt = dayjs(patch.start).tz(eventTz)
            const oneHourLater = startAt.add(1, "hour")

            if (oneHourLater.isSame(startAt, "day")) {
                patch.end = oneHourLater.valueOf()
            } else {
                const endOfDay = startAt.endOf("day")
                const fiftyNineMinutesLater = startAt.add(59, "minute")
                patch.end = (
                    fiftyNineMinutesLater.isBefore(endOfDay)
                        ? fiftyNineMinutesLater
                        : endOfDay
                ).valueOf()
            }
        }

        if (drag.previewEvent?.recurrence?.type === "weekly") {
            patch.recurrence = shiftCalendarEventForDrag(
                toCalendarEventSource(drag.previewEvent),
                dayDelta,
                calendarTimezone
            ).recurrence
        }

        const currentEvent =
            events.find((event) => event.id === drag.eventId) ?? null
        const isNoopPatch =
            currentEvent !== null &&
            patch.start === currentEvent.start &&
            patch.end === currentEvent.end &&
            (patch.recurrence === undefined ||
                areRecurrenceValuesEqual(
                    patch.recurrence,
                    currentEvent.recurrence
                ))

        if (isNoopPatch) {
            set({
                drag: {
                    eventId: null,
                    renderId: null,
                    mode: null,
                    originStart: 0,
                    originEnd: 0,
                    sourceOriginStart: 0,
                    sourceOriginEnd: 0,
                    start: 0,
                    end: 0,
                    offset: 0,
                    segmentOffset: 0,
                    resizePinnedLane: null,
                    resizeLayoutWeekStart: null,
                    resizeActiveEdge: null,
                    previewEvent: null,
                    baseHoveredDateKeys: [],
                    hoveredDateKeys: [],
                },
            })
            return
        }

        const ok = updateEvent(drag.eventId, patch)

        if (!ok) {
            set({
                drag: {
                    eventId: null,
                    renderId: null,
                    mode: null,
                    originStart: 0,
                    originEnd: 0,
                    sourceOriginStart: 0,
                    sourceOriginEnd: 0,
                    start: 0,
                    end: 0,
                    offset: 0,
                    segmentOffset: 0,
                    resizePinnedLane: null,
                    resizeLayoutWeekStart: null,
                    resizeActiveEdge: null,
                    previewEvent: null,
                    baseHoveredDateKeys: [],
                    hoveredDateKeys: [],
                },
            })
            return
        }

        set({
            drag: {
                eventId: null,
                renderId: null,
                mode: null,
                originStart: 0,
                originEnd: 0,
                sourceOriginStart: 0,
                sourceOriginEnd: 0,
                start: 0,
                end: 0,
                offset: 0,
                segmentOffset: 0,
                resizePinnedLane: null,
                resizeLayoutWeekStart: null,
                resizeActiveEdge: null,
                previewEvent: null,
                baseHoveredDateKeys: [],
                hoveredDateKeys: [],
            },
        })
    },

    startSelection(date) {
        set({
            selection: {
                isSelecting: true,
                anchor: date,
                start: date,
                end: date,
            },
        })
    },

    updateSelection(date) {
        const { selection } = get()
        if (!selection.isSelecting || !selection.start) return

        const anchor = selection.anchor

        if (anchor === null) return

        const start = Math.min(anchor, date)
        const end = Math.max(anchor, date)

        set({
            selection: {
                ...selection,
                start,
                end,
            },
        })
    },

    endSelection() {
        const { selection } = get()

        if (!selection.start || !selection.end) return

        // ❌ 하루짜리는 생성하지 않음
        if (selection.start === selection.end) {
            set({
                selection: {
                    isSelecting: false,
                    anchor: null,
                    start: null,
                    end: null,
                },
            })
            return
        }

        // 🔥 이벤트 생성
        // createEvent({
        //     id: crypto.randomUUID(),
        //     title: "새 일정",
        //     start: selection.start,
        //     end: selection.end,
        //     timezone: calendarTimezone,
        //     color: "#3b82f6",
        //     createdAt: Date.now(),
        //     updatedAt: Date.now(),
        // })

        // set({
        //     selection: {
        //         isSelecting: false,
        //         start: null,
        //         end: null,
        //     },
        // })
    },
}))

export const CalendarStoreProvider = useCalendarStore.StoreProvider
