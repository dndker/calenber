"use client"

import { useDeleteEvent } from "@/hooks/use-delete-event"

type UseEventDeleteActionOptions = {
    eventId?: string
    onSuccess?: () => void
}

export function useEventDeleteAction({
    eventId,
    onSuccess,
}: UseEventDeleteActionOptions = {}) {
    const deleteEvent = useDeleteEvent()

    return async (targetEventId?: string) => {
        const resolvedEventId = targetEventId ?? eventId

        if (!resolvedEventId) {
            return false
        }

        const ok = await deleteEvent(resolvedEventId)

        if (ok) {
            onSuccess?.()
        }

        return ok
    }
}
