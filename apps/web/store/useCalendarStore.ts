import dayjs from "dayjs"
import { create } from "zustand"

type CalendarState = {
    selectedDate: number
    viewport: number
    viewportMini: number

    setSelectedDate: (date: Date) => void
    setViewportDate: (date: Date) => void
    setViewportMiniDate: (date: Date) => void
}

export const useCalendarStore = create<CalendarState>((set) => ({
    selectedDate: dayjs().startOf("day").valueOf(),
    viewport: dayjs().startOf("month").valueOf(),
    viewportMini: dayjs().startOf("month").valueOf(),

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
}))
