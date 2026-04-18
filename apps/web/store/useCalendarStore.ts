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
    CalendarStoreState,
} from "./calendar-store.types"
import { createSSRStore } from "./createSSRStore"
import { useAuthStore } from "./useAuthStore"

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
    patch: Partial<CalendarEvent>
) {
    const calendarId = getPersistableCalendarId()

    if (!calendarId) {
        return
    }

    const supabase = createBrowserSupabase()
    const ok = await updateCalendarEventQuery(supabase, eventId, patch)

    if (!ok) {
        toast.error("일정 수정 실패")
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
    eventLayout: "compact",

    // 캘린더 레이아웃
    selectedDate: 0,
    viewport: 0,
    viewportMini: 0,
    moveRange: null,
    isWorkspacePresenceLoading: false,
    workspaceCursor: null,
    workspacePresence: [],

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

    setIsCalendarLoading: (value) =>
        set({
            isCalendarLoading: value,
        }),
    setActiveEventId: (eventId) =>
        set({
            activeEventId: eventId,
        }),
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
            console.log(event)
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
            status: data.status ?? "scheduled",
            authorId: data.authorId ?? currentUserId,
            author: data.author ?? {
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
                start: null,
                end: null,
            },
        }))

        void persistCreatedEvent(event)

        return event.id
    },

    updateEvent: (id, patch) => {
        const state = get()
        const currentUserId = useAuthStore.getState().user?.id ?? null
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
                    e.id === id ? { ...e, ...patch, updatedAt: Date.now() } : e
                )
            ),
        }))

        void persistUpdatedEvent(id, patch)
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
                start: date,
                end: date,
            },
        })
    },

    updateSelection(date) {
        const { selection } = get()
        if (!selection.isSelecting || !selection.start) return

        const start = selection.start
        const end = date

        set({
            selection: {
                ...selection,
                start: Math.min(start, end),
                end: Math.max(start, end),
            },
        })
    },

    endSelection() {
        const { selection, createEvent, calendarTimezone } = get()

        if (!selection.start || !selection.end) return

        // ❌ 하루짜리는 생성하지 않음
        if (selection.start === selection.end) {
            set({
                selection: {
                    isSelecting: false,
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
