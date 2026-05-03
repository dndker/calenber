import { parseGoogleCalendarEventId } from "@/lib/google/calendar-event-mapper"
import { useCalendarStore } from "@/store/useCalendarStore"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { toast } from "sonner"

export function useDeleteEvent() {
    const deleteEvent = useCalendarStore((s) => s.deleteEvent)
    const subscriptionCatalogs = useCalendarStore((s) => s.subscriptionCatalogs)
    const t = useDebugTranslations("event.toast")

    return async (id: string) => {
        // gcal:<catalogId>:<googleEventId> 이벤트는 구글 API로 삭제
        const parsed = parseGoogleCalendarEventId(id)
        if (parsed) {
            const catalog = subscriptionCatalogs.find((c) => c.id === parsed.catalogId)
            const config = catalog?.config as
                | { googleCalendarId?: string; googleAccountId?: string }
                | undefined

            if (config?.googleCalendarId && config?.googleAccountId) {
                try {
                    const res = await fetch("/api/google-calendar/events", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            googleCalendarId: config.googleCalendarId,
                            googleAccountId: config.googleAccountId,
                            googleEventId: parsed.googleEventId,
                        }),
                    })
                    if (!res.ok) {
                        toast.error(t("deleteFailed"))
                        return false
                    }
                    toast.success(t("deleted"))
                    return true
                } catch {
                    toast.error(t("deleteFailed"))
                    return false
                }
            }
            // catalog 메타 없으면 실패 처리
            toast.error(t("deleteFailed"))
            return false
        }

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
