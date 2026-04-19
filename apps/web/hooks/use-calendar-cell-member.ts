// hooks/use-cell-members.ts
import { useCalendarStore } from "@/store/useCalendarStore"
import { useMemo } from "react"

export function useCellMembers(cellDate: string, userId?: string | null) {
    const workspacePresence = useCalendarStore((s) => s.workspacePresence)

    const myPresenceId =
        userId ??
        (typeof window !== "undefined"
            ? sessionStorage.getItem("calendar-workspace-anonymous-id")
            : null)

    const cellMembers = useMemo(() => {
        return workspacePresence
            .filter((member) => {
                if (member.id === myPresenceId) return false
                return member.cursor?.date === cellDate
            })
            .sort((a, b) => {
                if (a.cursor?.type !== b.cursor?.type) {
                    return a.cursor?.type === "event" ? -1 : 1
                }

                return a.displayName.localeCompare(b.displayName, "ko")
            })
    }, [cellDate, myPresenceId, workspacePresence])

    return cellMembers
}
