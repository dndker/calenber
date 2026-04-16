import { useCalendarStore } from "@/store/useCalendarStore"
import { toast } from "sonner"

export function useDeleteEvent() {
    const deleteEvent = useCalendarStore((s) => s.deleteEvent)

    return async (id: string) => {
        try {
            const ok = deleteEvent(id)

            if (!ok) {
                return false
            }

            toast.success("일정이 삭제되었습니다.")

            return true
        } catch {
            toast.error("일정 삭제 실패")
            return false
        }
    }
}
