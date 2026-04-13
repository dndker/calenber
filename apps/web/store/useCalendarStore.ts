"use client"

import dayjs from "@/lib/dayjs"
import { nanoid } from "nanoid"
import { createSSRStore } from "./createSSRStore"

export type CalendarEvent = {
    id: string

    title: string
    description?: string

    // 시간
    start: number // ISO (UTC)
    end: number // ISO (UTC)

    allDay?: boolean

    // 타임존
    timezone: string // "Asia/Seoul"

    // 색상
    color: string // tailwind token or hex

    // 반복 일정
    recurrence?: {
        type: "daily" | "weekly" | "monthly" | "yearly"
        interval: number // 1 = 매주, 2 = 2주마다
        byWeekday?: number[] // [1,3,5]
        until?: string // ISO
        count?: number
    }

    // 예외
    exceptions?: string[] // 제외 날짜

    // 메타
    createdAt: number
    updatedAt: number
}
type DragMode = "move" | "resize-start" | "resize-end"
type DragState = {
    eventId: string | null
    mode: "move" | "resize-start" | "resize-end" | null

    originStart: number
    originEnd: number

    start: number
    end: number
    offset: number
}

type SelectionState = {
    isSelecting: boolean
    start: number | null
    end: number | null
}

type CalendarStoreState = {
    calendarTimezone: string
    isCalendarLoading: boolean

    // 캘린더 레이아웃
    selectedDate: number
    viewport: number
    viewportMini: number
    moveRange: { start: number; end: number } | null
    setCalendarTimezone: (tz: string) => void
    setIsCalendarLoading: (value: boolean) => void
    setSelectedDate: (date: Date) => void
    setViewportDate: (date: Date) => void
    setViewportMiniDate: (date: Date) => void

    // 일정 레이아웃
    events: CalendarEvent[]

    setEvents: (events: CalendarEvent[]) => void
    createEvent: (
        data: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">
    ) => string
    updateEvent: (id: string, patch: Partial<CalendarEvent>) => void
    deleteEvent: (id: string) => void
}

type CalendarDragState = {
    drag: DragState
    startDrag: (
        event: CalendarEvent,
        mode: DragMode,
        clickedDate: number
    ) => void
    moveDrag: (date: number) => void
    endDrag: () => void

    selection: SelectionState
    startSelection: (date: number) => void
    updateSelection: (date: number) => void
    endSelection: () => void
}

export const useCalendarStore = createSSRStore<
    CalendarStoreState & CalendarDragState
>((set, get) => ({
    isCalendarLoading: true,
    calendarTimezone: "Asia/Seoul",

    // 캘린더 레이아웃
    selectedDate: 0,
    viewport: 0,
    viewportMini: 0,
    moveRange: null,

    setCalendarTimezone: (tz: string) => set({ calendarTimezone: tz }),

    setIsCalendarLoading: (value) =>
        set({
            isCalendarLoading: value,
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

    setEvents: (events) => set({ events }),
    createEvent: (data) => {
        const now = Date.now()

        const event: CalendarEvent = {
            id: nanoid(),
            ...data,
            createdAt: now,
            updatedAt: now,
        }

        set((s) => ({
            events: [...s.events, event],
        }))

        return event.id
    },

    updateEvent: (id, patch) =>
        set((s) => ({
            events: s.events.map((e) =>
                e.id === id ? { ...e, ...patch, updatedAt: Date.now() } : e
            ),
        })),

    deleteEvent: (id) =>
        set((s) => ({
            events: s.events.filter((e) => e.id !== id),
        })),

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

            set({
                drag: {
                    ...drag,
                    start: newStart.valueOf(),
                    end: newStart.add(duration, "day").valueOf(),
                },
            })
        }

        if (drag.mode === "resize-start") {
            if (normalized.valueOf() >= drag.end) return
            set({
                drag: { ...drag, start: normalized.valueOf() },
            })
        }

        if (drag.mode === "resize-end") {
            if (normalized.valueOf() <= drag.start) return
            set({
                drag: { ...drag, end: normalized.valueOf() },
            })
        }
    },

    endDrag() {
        const { drag, updateEvent } = get()
        if (!drag.eventId) return

        updateEvent(drag.eventId, {
            start: drag.start,
            end: drag.end,
        })

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

        console.log(
            dayjs(selection.start).format("YYYY-MM-DD"),
            dayjs(selection.end).format("YYYY-MM-DD")
        )

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
