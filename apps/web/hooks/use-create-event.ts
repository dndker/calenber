import type { CalendarEvent } from "@/store/calendar-store.types"
import { useCalendarStore } from "@/store/useCalendarStore"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { toast } from "sonner"

export function useCreateEvent() {
    const createEvent = useCalendarStore((s) => s.createEvent)
    const t = useDebugTranslations("event.toast")

    return (event: CalendarEvent) => {
        try {
            const createdEventId = createEvent(event)

            if (!createdEventId) {
                return null
            }

            return createdEventId
        } catch {
            toast.error(t("createFailed"))
            return null
        }
    }
}
