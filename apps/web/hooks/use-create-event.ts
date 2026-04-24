import type { CalendarEvent } from "@/store/calendar-store.types"
import { useCalendarStore } from "@/store/useCalendarStore"
import { toast } from "sonner"

export function useCreateEvent() {
    const createEvent = useCalendarStore((s) => s.createEvent)

    return (event: CalendarEvent) => {
        try {
            const createdEventId = createEvent(event)

            if (!createdEventId) {
                return null
            }

            return createdEventId
        } catch {
            toast.error("일정 생성 실패")
            return null
        }
    }
}
