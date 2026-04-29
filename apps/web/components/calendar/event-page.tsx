"use client"

import { useCalendarEventDetail } from "@/hooks/use-calendar-event-detail"
import { isSubscriptionStyleEventId } from "@/lib/calendar/event-id"
import { useEventDeleteAction } from "@/hooks/use-event-delete-action"
import { canEditCalendarEvent } from "@/lib/calendar/permissions"
import { getCalendarBasePath } from "@/lib/calendar/routes"
import {
    getCalendarShareTitle,
    getEventShareTitle,
} from "@/lib/calendar/share-metadata"
import { APP_NAME } from "@/lib/app-config"
import type { CalendarEvent } from "@/store/calendar-store.types"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { EventForm } from "./event-form"
import { EventHeader } from "./event-header"

export function EventPage({
    modal = false,
    eventId,
    occurrenceStart,
    initialEvent,
}: {
    modal?: boolean
    eventId?: string
    occurrenceStart?: number
    initialEvent?: CalendarEvent | null
}) {
    const tDialog = useDebugTranslations("event.dialog")
    const tActions = useDebugTranslations("event.actions")
    const tCommon = useDebugTranslations("common.actions")
    const router = useRouter()
    const pathname = usePathname()
    const basePath = getCalendarBasePath(pathname)

    const updateEvent = useCalendarStore((s) => s.updateEvent)
    const activeCalendar = useCalendarStore((s) => s.activeCalendar)
    const activeCalendarMembership = useCalendarStore(
        (s) => s.activeCalendarMembership
    )
    const user = useAuthStore((s) => s.user)

    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
        null
    )
    const portalContainerRef = useRef<HTMLElement | null>(null)
    const handlePortalContainerRef = useCallback((node: HTMLElement | null) => {
        if (portalContainerRef.current === node) {
            return
        }
        portalContainerRef.current = node
        setPortalContainer(node)
    }, [])

    const { event, isLoading, isMissing } = useCalendarEventDetail({
        eventId,
        occurrenceStart,
        initialEvent,
    })

    useEffect(() => {
        if (!event) {
            return
        }

        const nextTitle = getEventShareTitle(event, activeCalendar)
        document.title =
            nextTitle === APP_NAME ? APP_NAME : `${nextTitle} - ${APP_NAME}`

        return () => {
            const calendarTitle = getCalendarShareTitle(activeCalendar)
            document.title =
                calendarTitle === APP_NAME
                    ? APP_NAME
                    : `${calendarTitle} - ${APP_NAME}`
        }
    }, [activeCalendar, event])

    const {
        handleDeleteEvent,
        isRecurringDeleteDialogOpen,
        canDeleteSingleOccurrence,
        closeRecurringDeleteDialog,
        confirmDeleteOnlyThis,
        confirmDeleteSeries,
    } = useEventDeleteAction({
        eventId,
        event,
        onSuccess: () => {
            router.replace(basePath)
        },
    })

    if (isLoading && !event) {
        return (
            <div className="flex flex-col gap-4">
                {!modal && <Skeleton className="h-12 w-full rounded-xl" />}
                <div className="flex flex-col gap-3">
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <Skeleton className="h-30 w-full rounded-xl" />
                    <Skeleton className="h-56 w-full rounded-xl" />
                </div>
            </div>
        )
    }

    if (isMissing) {
        return (
            <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                {tDialog("notFound")}
            </div>
        )
    }

    if (!event) return null

    const canEdit =
        !isSubscriptionStyleEventId(event.id) &&
        (activeCalendar?.id === "demo" ||
            canEditCalendarEvent(event, activeCalendarMembership, user?.id))

    return (
        <>
            <div
                className="cb-event-page flex flex-col gap-4"
                ref={handlePortalContainerRef}
            >
                {!modal && (
                    <EventHeader
                        id={eventId}
                        event={event}
                        modal={modal}
                        onDeleteEvent={handleDeleteEvent}
                        portalContainer={portalContainer}
                    />
                )}

                <EventForm
                    key={event.recurrenceInstance?.key ?? event.id}
                    modal={modal}
                    event={event}
                    disabled={!canEdit}
                    portalContainer={portalContainer}
                    onChange={(patch, options) => {
                        updateEvent(event.id, patch, options)
                    }}
                />
            </div>
            <AlertDialog
                open={isRecurringDeleteDialogOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        closeRecurringDeleteDialog()
                    }
                }}
            >
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {tDialog("recurringDeleteTitle")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {tDialog("recurringDeleteDescription")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            {tCommon("cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={!canDeleteSingleOccurrence}
                            onClick={(dialogEvent) => {
                                dialogEvent.preventDefault()
                                void confirmDeleteOnlyThis()
                            }}
                        >
                            {tActions("deleteThis")}
                        </AlertDialogAction>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={(dialogEvent) => {
                                dialogEvent.preventDefault()
                                void confirmDeleteSeries()
                            }}
                        >
                            {tActions("deleteAll")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
