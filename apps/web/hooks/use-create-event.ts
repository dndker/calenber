import type { CalendarEvent } from "@/store/calendar-store.types"
import { useCalendarStore } from "@/store/useCalendarStore"
import { toast } from "sonner"

export function useCreateEvent() {
    const createEvent = useCalendarStore((s) => s.createEvent)
    const upsertEventSnapshot = useCalendarStore((s) => s.upsertEventSnapshot)

    return async (event: CalendarEvent) => {
        try {
            const createdEventId = createEvent(event)

            if (!createdEventId) {
                return false
            }

            // Keep the local snapshot available immediately so modal/page flows
            // don't depend on the round-trip query succeeding first.
            upsertEventSnapshot(event)
            return true
        } catch {
            toast.error("일정 생성 실패")
            return false
        }
    }
}
