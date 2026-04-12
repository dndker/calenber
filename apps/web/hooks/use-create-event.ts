import { CalendarEvent, useCalendarStore } from "@/store/useCalendarStore"
import { toast } from "sonner"

export function useCreateEvent() {
    const addEvent = useCalendarStore((s) => s.addEvent)

    return async (event: CalendarEvent) => {
        try {
            // const res = await api.createEvent(event)

            addEvent(event)

            console.log("일정이 생성되었습니다")
            toast.success("일정이 생성되었습니다.")

            return true
        } catch {
            toast.error("일정 생성 실패")
            return false
        }
    }
}
