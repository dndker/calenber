"use client"

import {
    createCalendarEvent,
    deleteCalendarEvent,
    updateCalendarEvent as updateCalendarEventQuery,
} from "@/lib/calendar/mutations"
import {
    canCreateCalendarEvents,
    canDeleteCalendarEvent,
    canEditCalendarEvent,
} from "@/lib/calendar/permissions"
import type { MyCalendarItem } from "@/lib/calendar/queries"
import dayjs from "@/lib/dayjs"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { toast } from "sonner"
import type {
    CalendarDragState,
    CalendarEvent,
    CalendarEventFilterState,
    CalendarStoreState,
} from "./calendar-store.types"
import { createSSRStore } from "./createSSRStore"
import { useAuthStore } from "./useAuthStore"

const defaultExcludedStatuses: CalendarEventFilterState["excludedStatuses"] = [
    "completed",
    "cancelled",
]

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
    patch: Partial<CalendarEvent>,
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
        if (result.event.categories.length > 0) {
            const store = useCalendarStore.getState()

            result.event.categories.forEach((category) => {
                store.upsertEventCategorySnapshot(category)
            })
        }

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

function sortEventCategories(
    categories: CalendarStoreState["eventCategories"]
) {
    return [...categories].sort((a, b) => {
        const nameCompare = a.name.localeCompare(b.name)

        if (nameCompare !== 0) {
            return nameCompare
        }

        return a.id.localeCompare(b.id)
    })
}

function toggleStringFilterItem(items: string[], value: string) {
    return items.includes(value)
        ? items.filter((item) => item !== value)
        : [...items, value]
}

function pruneEventFilters(
    filters: CalendarEventFilterState,
    categories: CalendarStoreState["eventCategories"]
) {
    if (filters.excludedCategoryIds.length === 0) {
        return filters
    }

    const availableCategoryIds = new Set(categories.map((category) => category.id))
    const excludedCategoryIds = filters.excludedCategoryIds.filter((categoryId) =>
        availableCategoryIds.has(categoryId)
    )

    if (excludedCategoryIds.length === filters.excludedCategoryIds.length) {
        return filters
    }

    return {
        ...filters,
        excludedCategoryIds,
    }
}

function deriveEventCategories(
    categories: CalendarEvent["categories"] | undefined,
    fallbackCategories: CalendarStoreState["eventCategories"] = []
) {
    const nextCategories = categories ?? []
    const categoryIds = nextCategories.map((category) => category.id)
    const primaryCategoryId = categoryIds[0] ?? null
    const primaryCategory =
        nextCategories[0] ??
        (primaryCategoryId
            ? (fallbackCategories.find(
                  (category) => category.id === primaryCategoryId
              ) ?? null)
            : null)

    return {
        categoryIds,
        categories: nextCategories,
        categoryId: primaryCategoryId,
        category: primaryCategory,
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
    eventCategories: [],
    eventFilters: {
        excludedStatuses: defaultExcludedStatuses,
        excludedCategoryIds: [],
    },

    setMyCalendars: (myCalendars) => set({ myCalendars }),
    setActiveCalendar: (activeCalendar) => set({ activeCalendar }),
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
            eventCategories: [],
            eventFilters: {
                excludedStatuses: defaultExcludedStatuses,
                excludedCategoryIds: [],
            },
        }),
    updateCalendarSnapshot: (calendarId, patch) =>
        set((s) => ({
            myCalendars: s.myCalendars.map((calendar) =>
                calendar.id === calendarId
                    ? { ...calendar, ...patch }
                    : calendar
            ),
            activeCalendar:
                s.activeCalendar?.id === calendarId
                    ? { ...s.activeCalendar, ...patch }
                    : s.activeCalendar,
        })),

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
    setEventCategories: (eventCategories) =>
        set((state) => {
            const sortedCategories = sortEventCategories(eventCategories)

            return {
                eventCategories: sortedCategories,
                eventFilters: pruneEventFilters(
                    state.eventFilters,
                    sortedCategories
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
    toggleEventCategoryFilter: (categoryId) =>
        set((state) => ({
            eventFilters: {
                ...state.eventFilters,
                excludedCategoryIds: toggleStringFilterItem(
                    state.eventFilters.excludedCategoryIds,
                    categoryId
                ),
            },
        })),
    resetEventFilters: () =>
        set((state) => {
            if (
                state.eventFilters.excludedStatuses.length ===
                    defaultExcludedStatuses.length &&
                state.eventFilters.excludedStatuses.every(
                    (status, index) =>
                        status === defaultExcludedStatuses[index]
                ) &&
                state.eventFilters.excludedCategoryIds.length === 0
            ) {
                return state
            }

            return {
                eventFilters: {
                    excludedStatuses: defaultExcludedStatuses,
                    excludedCategoryIds: [],
                },
            }
        }),
    upsertEventCategorySnapshot: (category) =>
        set((state) => {
            const nextCategories = state.eventCategories.some(
                (item) => item.id === category.id
            )
                ? state.eventCategories.map((item) =>
                      item.id === category.id ? { ...item, ...category } : item
                  )
                : [...state.eventCategories, category]

            return {
                eventCategories: sortEventCategories(nextCategories),
            }
        }),
    removeEventCategorySnapshot: (categoryId) =>
        set((state) => ({
            eventCategories: state.eventCategories.filter(
                (category) => category.id !== categoryId
            ),
            eventFilters: {
                ...state.eventFilters,
                excludedCategoryIds: state.eventFilters.excludedCategoryIds.filter(
                    (id) => id !== categoryId
                ),
            },
        })),
    setEventCategoryDefaultVisibility: (categoryId, visibleByDefault) =>
        set((state) => {
            const nextCategories = state.eventCategories.map((category) =>
                category.id === categoryId
                    ? {
                          ...category,
                          options: {
                              ...category.options,
                              visibleByDefault,
                          },
                      }
                    : category
            )

            const nextExcludedCategoryIds = visibleByDefault
                ? state.eventFilters.excludedCategoryIds.filter(
                      (id) => id !== categoryId
                  )
                : Array.from(
                      new Set([
                          ...state.eventFilters.excludedCategoryIds,
                          categoryId,
                      ])
                  )

            return {
                eventCategories: sortEventCategories(nextCategories),
                eventFilters: {
                    ...state.eventFilters,
                    excludedCategoryIds: nextExcludedCategoryIds,
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
        mode: null,
        originStart: 0,
        originEnd: 0,
        start: 0,
        end: 0,
        offset: 0,
        isStartEdge: false,
        isEndEdge: false,
    },

    setEvents: (events) => set({ events: sortCalendarEvents(events) }),
    upsertEventSnapshot: (event) =>
        set((state) => {
            const nextEvents = state.events.some((item) => item.id === event.id)
                ? state.events.map((item) =>
                      item.id === event.id ? { ...item, ...event } : item
                  )
                : [...state.events, event]

            return {
                events: sortCalendarEvents(nextEvents),
            }
        }),
    removeEventSnapshot: (id) =>
        set((state) => ({
            events: state.events.filter((event) => event.id !== id),
            activeEventId:
                state.activeEventId === id ? undefined : state.activeEventId,
        })),
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

        const event: CalendarEvent = {
            id: crypto.randomUUID(),
            ...data,
            ...deriveEventCategories(data.categories, get().eventCategories),
            categoryIds:
                data.categoryIds ??
                data.categories?.map((category) => category.id) ??
                [],
            categories: data.categories ?? [],
            categoryId:
                data.categoryId ??
                data.category?.id ??
                data.categoryIds?.[0] ??
                data.categories?.[0]?.id ??
                null,
            category: data.category ?? data.categories?.[0] ?? null,
            participants: data.participants ?? [],
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
            createdAt: now,
            updatedAt: now,
        }

        set((s) => ({
            events: sortCalendarEvents([...s.events, event]),
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

    updateEvent: (id, patch, options) => {
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
                              categoryIds:
                                  patch.categoryIds !== undefined
                                      ? patch.categoryIds
                                      : patch.categories !== undefined
                                        ? patch.categories
                                              .map((category) => category.id)
                                              .filter(Boolean)
                                        : e.categoryIds,
                              categories:
                                  patch.categories !== undefined
                                      ? patch.categories
                                      : patch.categoryIds !== undefined
                                        ? s.eventCategories.filter((category) =>
                                              patch.categoryIds?.includes(
                                                  category.id
                                              )
                                          )
                                        : e.categories,
                              categoryId:
                                  patch.categoryId !== undefined
                                      ? patch.categoryId
                                      : patch.category !== undefined
                                        ? patch.category?.id || null
                                        : patch.categoryIds !== undefined
                                          ? (patch.categoryIds[0] ?? null)
                                          : patch.categories !== undefined
                                            ? patch.categories[0]?.id || null
                                            : e.categoryId,
                              category:
                                  patch.category !== undefined
                                      ? patch.category
                                      : patch.categories !== undefined
                                        ? (patch.categories[0] ?? null)
                                        : patch.categoryIds !== undefined
                                          ? (s.eventCategories.find(
                                                (category) =>
                                                    category.id ===
                                                    patch.categoryIds?.[0]
                                            ) ?? null)
                                          : patch.categoryId !== undefined
                                            ? (s.eventCategories.find(
                                                  (category) =>
                                                      category.id ===
                                                      patch.categoryId
                                              ) ?? null)
                                            : e.category,
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
        }))

        void persistDeletedEvent(id)
        return true
    },

    startDrag(event, mode, offset) {
        set({
            drag: {
                eventId: event.id,
                mode,
                originStart: event.start,
                originEnd: event.end,
                start: event.start,
                end: event.end,
                offset,
            },
        })
    },

    moveDrag(date) {
        const { drag } = get()
        if (!drag.eventId) return

        const normalized = dayjs(date).startOf("day")

        const duration = dayjs(drag.originEnd)
            .startOf("day")
            .diff(dayjs(drag.originStart).startOf("day"), "day")

        if (drag.mode === "move") {
            const newStart = normalized.subtract(drag.offset, "day")
            const nextStart = newStart.valueOf()
            const nextEnd = newStart.add(duration, "day").valueOf()

            if (drag.start === nextStart && drag.end === nextEnd) {
                return
            }

            set({
                drag: {
                    ...drag,
                    start: nextStart,
                    end: nextEnd,
                },
            })
        }

        if (drag.mode === "resize-start") {
            const nextStart = normalized.valueOf()
            if (nextStart >= drag.end || nextStart === drag.start) return
            set({
                drag: { ...drag, start: nextStart },
            })
        }

        if (drag.mode === "resize-end") {
            const nextEnd = normalized.valueOf()
            if (nextEnd <= drag.start || nextEnd === drag.end) return
            set({
                drag: { ...drag, end: nextEnd },
            })
        }
    },

    endDrag() {
        const { drag, updateEvent } = get()
        if (!drag.eventId) return

        const ok = updateEvent(drag.eventId, {
            start: drag.start,
            end: drag.end,
        })

        if (!ok) {
            set({
                drag: {
                    eventId: null,
                    mode: null,
                    originStart: 0,
                    originEnd: 0,
                    start: 0,
                    end: 0,
                    offset: 0,
                },
            })
            return
        }

        set({
            drag: {
                eventId: null,
                mode: null,
                originStart: 0,
                originEnd: 0,
                start: 0,
                end: 0,
                offset: 0,
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
