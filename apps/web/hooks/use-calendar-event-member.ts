import { useCalendarStore } from "@/store/useCalendarStore"
import { useMemo } from "react"

export function useEventMembers(eventId: string, userId?: string | null) {
    const workspacePresence = useCalendarStore((s) => s.workspacePresence)

    const myPresenceId =
        userId ??
        (typeof window !== "undefined"
            ? sessionStorage.getItem("calendar-workspace-anonymous-id")
            : null)

    return useMemo(() => {
        return workspacePresence.filter((member) => {
            if (member.id === myPresenceId) return false
            return member.cursor?.eventId === eventId
        })
    }, [workspacePresence, myPresenceId, eventId])
}
