"use client"

import { useDeleteEvent } from "@/hooks/use-delete-event"
import { getCalendarEventSourceId } from "@/lib/calendar/recurrence"
import type { CalendarEvent } from "@/store/calendar-store.types"
import { useCalendarStore } from "@/store/useCalendarStore"
import { useCallback, useState } from "react"
import { toast } from "sonner"

type UseEventDeleteActionOptions = {
    eventId?: string
    event?: CalendarEvent | null
    onSuccess?: () => void
}

export function useEventDeleteAction({
    eventId,
    event,
    onSuccess,
}: UseEventDeleteActionOptions = {}) {
    const deleteEvent = useDeleteEvent()
    const updateEvent = useCalendarStore((s) => s.updateEvent)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [pendingDeleteEvent, setPendingDeleteEvent] = useState<{
        eventId: string
        occurrenceStart?: number
    } | null>(null)

    const handleDeleteSuccess = useCallback(() => {
        onSuccess?.()
    }, [onSuccess])

    const getResolvedEvent = useCallback(
        (resolvedEventId: string, targetEvent?: CalendarEvent) => {
            if (targetEvent) {
                return targetEvent
            }

            if (event?.id === resolvedEventId) {
                return event
            }

            const { viewEvent, events } = useCalendarStore.getState()
            return (
                (viewEvent?.id === resolvedEventId ? viewEvent : null) ??
                events.find((item) => item.id === resolvedEventId) ??
                null
            )
        },
        [event]
    )

    const closeRecurringDeleteDialog = useCallback(() => {
        setIsDialogOpen(false)
        setPendingDeleteEvent(null)
    }, [])

    const confirmDeleteSeries = async () => {
        if (!pendingDeleteEvent) {
            return false
        }

        const ok = await deleteEvent(pendingDeleteEvent.eventId)

        if (ok) {
            closeRecurringDeleteDialog()
            handleDeleteSuccess()
        }

        return ok
    }

    const confirmDeleteOnlyThis = async () => {
        if (!pendingDeleteEvent?.occurrenceStart) {
            return false
        }

        const sourceEvent = useCalendarStore.getState().events.find(
            (item) =>
                item.id === pendingDeleteEvent.eventId &&
                !item.recurrenceInstance
        )

        if (!sourceEvent) {
            return false
        }

        const exception = new Date(
            pendingDeleteEvent.occurrenceStart
        ).toISOString()
        const nextExceptions = Array.from(
            new Set([...(sourceEvent.exceptions ?? []), exception])
        )
        const ok = updateEvent(sourceEvent.id, {
            exceptions: nextExceptions,
        })

        if (ok) {
            toast.success("일정이 삭제되었습니다.")
            closeRecurringDeleteDialog()
            handleDeleteSuccess()
        }

        return ok
    }

    const handleDeleteEvent = async (
        targetEventId?: string,
        targetEvent?: CalendarEvent
    ) => {
        const resolvedEventId = targetEventId ?? eventId

        if (!resolvedEventId) {
            return false
        }

        const resolvedEvent = getResolvedEvent(resolvedEventId, targetEvent)
        const sourceEventId = resolvedEvent
            ? getCalendarEventSourceId(resolvedEvent)
            : resolvedEventId
        const isRecurringEvent = Boolean(
            resolvedEvent?.recurrence || resolvedEvent?.recurrenceInstance
        )

        if (isRecurringEvent) {
            setPendingDeleteEvent({
                eventId: sourceEventId,
                occurrenceStart:
                    resolvedEvent?.recurrenceInstance?.occurrenceStart,
            })
            setIsDialogOpen(true)
            return false
        }

        const ok = await deleteEvent(resolvedEventId)

        if (ok) {
            handleDeleteSuccess()
        }

        return ok
    }

    return {
        handleDeleteEvent,
        isRecurringDeleteDialogOpen: isDialogOpen,
        canDeleteSingleOccurrence: Boolean(pendingDeleteEvent?.occurrenceStart),
        closeRecurringDeleteDialog,
        confirmDeleteOnlyThis,
        confirmDeleteSeries,
    }
}
