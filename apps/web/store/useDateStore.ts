import { create } from "zustand"

interface DateState {
    selectedDate: Date // DatePicker용 (선택된 날짜)
    now: Date // 실시간 시계용

    // 액션
    setSelectedDate: (date: Date) => void
    updateNow: () => void // 시간을 갱신하는 함수
}

export const useDateStore = create<DateState>((set) => ({
    selectedDate: new Date(),
    now: new Date(),

    setSelectedDate: (date) => set({ selectedDate: date }),

    updateNow: () => set({ now: new Date() }),
}))
