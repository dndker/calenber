import { useCalendarStore } from "@/store/useCalendarStore"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { toast } from "sonner"

export function useDeleteEvent() {
    const deleteEvent = useCalendarStore((s) => s.deleteEvent)
    const t = useDebugTranslations("event.toast")

    return async (id: string) => {
        try {
            const ok = deleteEvent(id)

            if (!ok) {
                return false
            }

            toast.success(t("deleted"))

            return true
        } catch {
            toast.error(t("deleteFailed"))
            return false
        }
    }
}
