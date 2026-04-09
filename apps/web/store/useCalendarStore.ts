"use client"

import dayjs from "@/lib/dayjs"
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

type CalendarStoreState = {
    calendarTimezone: string
    isCalendarLoading: boolean

    // 캘린더 레이아웃
    selectedDate: number
    viewport: number
    viewportMini: number
    setCalendarTimezone: (tz: string) => void
    setIsCalendarLoading: (value: boolean) => void
    setSelectedDate: (date: Date) => void
    setViewportDate: (date: Date) => void
    setViewportMiniDate: (date: Date) => void

    // 일정 레이아웃
    events: CalendarEvent[]

    draggingEventId?: string
    draggingOverDate?: string

    setEvents: (events: CalendarEvent[]) => void
    addEvent: (event: CalendarEvent) => void
    updateEvent: (id: string, patch: Partial<CalendarEvent>) => void
    removeEvent: (id: string) => void
    draggingEvent?: CalendarEvent
    setDraggingEvent: (event?: CalendarEvent) => void
    setDraggingEventId: (id?: string) => void
    setDraggingOverDate: (date?: string) => void

    dragOffset: number
    setDragOffset: (x: number) => void
}

export const useCalendarStore = createSSRStore<CalendarStoreState>((set) => ({
    isCalendarLoading: true,
    calendarTimezone: "Asia/Seoul",

    // 캘린더 레이아웃
    selectedDate: 0,
    viewport: 0,
    viewportMini: 0,

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

    draggingEvent: undefined,
    draggingOverDate: undefined,

    setEvents: (events) => set({ events }),
    addEvent: (event) => set((s) => ({ events: [...s.events, event] })),

    updateEvent: (id, patch) =>
        set((s) => ({
            events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),

    removeEvent: (id) =>
        set((s) => ({
            events: s.events.filter((e) => e.id !== id),
        })),

    setDraggingEvent: (event) => set({ draggingEvent: event }),
    setDraggingEventId: (id) =>
        set({
            draggingEventId: id,
        }),
    setDraggingOverDate: (date) => set({ draggingOverDate: date }),

    dragOffset: 0,

    setDragOffset: (x) =>
        set({
            dragOffset: x,
        }),
}))

export const CalendarStoreProvider = useCalendarStore.StoreProvider
