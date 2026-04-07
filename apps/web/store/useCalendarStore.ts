import dayjs from "@/lib/dayjs"
import { generateMockEvents } from "@/lib/mock-event"
import { create } from "zustand"

export type CalendarEvent = {
    id: string

    title: string
    description?: string

    // 시간
    start: string // ISO (UTC)
    end: string // ISO (UTC)

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

    // 드래그용 메타
    draggable?: boolean
    resizable?: boolean

    // 메타
    createdAt: string
    updatedAt: string
}

type CalendarState = {
    isCalendarLoading: boolean

    // 캘린더 레이아웃
    selectedDate: number
    viewport: number
    viewportMini: number
    setIsCalendarLoading: (value: boolean) => void
    setSelectedDate: (date: Date) => void
    setViewportDate: (date: Date) => void
    setViewportMiniDate: (date: Date) => void

    // 일정 레이아웃
    events: CalendarEvent[]

    selectedRange: { start: Date; end: Date } | null
    draggingEventId?: string

    addEvent: (event: CalendarEvent) => void
    updateEvent: (id: string, patch: Partial<CalendarEvent>) => void
    removeEvent: (id: string) => void
    setRange: (range: CalendarState["selectedRange"]) => void
    setDraggingEventId: (id?: string) => void
}

export const useCalendarStore = create<CalendarState>((set) => ({
    isCalendarLoading: true,

    // 캘린더 레이아웃
    selectedDate: dayjs().startOf("day").valueOf(),
    viewport: dayjs().startOf("month").valueOf(),
    viewportMini: dayjs().startOf("month").valueOf(),

    setIsCalendarLoading: (value) =>
        set({
            isCalendarLoading: value,
        }),
    setSelectedDate: (date) =>
        set({
            selectedDate: dayjs(date).startOf("day").valueOf(),
        }),
    setViewportDate: (date) =>
        set({
            viewport: dayjs(date).startOf("month").valueOf(),
        }),
    setViewportMiniDate: (date) =>
        set({
            viewportMini: dayjs(date).startOf("month").valueOf(),
        }),

    // 일정 레이아웃
    events: generateMockEvents(),
    selectedRange: null,

    addEvent: (event) => set((s) => ({ events: [...s.events, event] })),

    updateEvent: (id, patch) =>
        set((s) => ({
            events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),

    removeEvent: (id) =>
        set((s) => ({
            events: s.events.filter((e) => e.id !== id),
        })),

    setRange: (range) => set({ selectedRange: range }),
    setDraggingEventId: (id) =>
        set({
            draggingEventId: id,
        }),
}))
