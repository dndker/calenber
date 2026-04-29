"use client"

import { useCalendarEventDetail } from "@/hooks/use-calendar-event-detail"
import { useMediaQuery } from "@/hooks/use-media-query"
import { navigateCalendarModal } from "@/lib/calendar/modal-navigation"
import {
    getCalendarModalClosePath,
    getCalendarModalEventId,
    getCalendarModalOccurrenceStart,
} from "@/lib/calendar/modal-route"
import type { CalendarEvent } from "@/store/calendar-store.types"
import { usePathname, useSearchParams } from "next/navigation"
import * as React from "react"

import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@workspace/ui/components/dialog"
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
import { Drawer, DrawerContent } from "@workspace/ui/components/drawer"

import { EventPage } from "@/components/calendar/event-page"
import { useEventDeleteAction } from "@/hooks/use-event-delete-action"
import { useCalendarStore } from "@/store/useCalendarStore"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { EventHeader } from "./event-header"

export const EventModal = React.memo(function EventModal({
    initialEvent,
}: {
    initialEvent?: CalendarEvent | null
}) {
    const tDialog = useDebugTranslations("event.dialog")
    const tActions = useDebugTranslations("event.actions")
    const tCommon = useDebugTranslations("common.actions")
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const isDesktop = useMediaQuery("(min-width: 768px)")
    const setActiveEventId = useCalendarStore((state) => state.setActiveEventId)
    const setViewEvent = useCalendarStore((state) => state.setViewEvent)
    const activeEventId = useCalendarStore((state) => state.activeEventId)
    const [portalContainer, setPortalContainer] =
        React.useState<HTMLElement | null>(null)
    const portalContainerRef = React.useRef<HTMLElement | null>(null)
    const handlePortalContainerRef = React.useCallback(
        (node: HTMLElement | null) => {
            if (portalContainerRef.current === node) {
                return
            }
            portalContainerRef.current = node
            setPortalContainer(node)
        },
        []
    )
    const urlEventId = React.useMemo(
        () => getCalendarModalEventId(searchParams),
        [searchParams]
    )
    const urlOccurrenceStart = React.useMemo(
        () => getCalendarModalOccurrenceStart(searchParams),
        [searchParams]
    )
    const eventId = activeEventId ?? urlEventId
    const basePath = getCalendarModalClosePath(pathname)

    const open = Boolean(eventId)

    React.useEffect(() => {
        if (!urlEventId) {
            if (!activeEventId) {
                return
            }

            setActiveEventId(undefined)
            setViewEvent(null)
            return
        }

        if (activeEventId !== urlEventId) {
            setActiveEventId(urlEventId)
        }
    }, [activeEventId, setActiveEventId, setViewEvent, urlEventId])

    const { event, isMissing } = useCalendarEventDetail({
        eventId,
        occurrenceStart: urlOccurrenceStart,
        initialEvent:
            initialEvent && initialEvent.id === eventId ? initialEvent : null,
    })

    React.useEffect(() => {
        if (!event || event.id !== eventId) {
            return
        }

        setViewEvent(event)
    }, [event, eventId, setViewEvent])

    React.useEffect(() => {
        if (!eventId || !isMissing) {
            return
        }

        setActiveEventId(undefined)
        setViewEvent(null)
        navigateCalendarModal(basePath, { replace: true })
    }, [basePath, eventId, isMissing, setActiveEventId, setViewEvent])

    const handleClose = React.useCallback(() => {
        if (!eventId) {
            return
        }

        useCalendarStore.setState({
            selection: {
                isSelecting: false,
                start: null,
                end: null,
                anchor: null,
            },
        })

        setActiveEventId(undefined)
        setViewEvent(null)
        navigateCalendarModal(basePath, { replace: true })
    }, [basePath, eventId, setActiveEventId, setViewEvent])

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
            setActiveEventId(undefined)
            setViewEvent(null)
            navigateCalendarModal(basePath, { replace: true })
        },
    })

    if (!eventId) {
        return null
    }

    const content = (
        <div
            className="cb-event-page"
            ref={handlePortalContainerRef}
        >
            <EventPage
                modal
                eventId={eventId}
                occurrenceStart={urlOccurrenceStart}
                initialEvent={event}
            />
        </div>
    )

    if (isDesktop) {
        return (
            <>
                <Dialog
                    open={open}
                    onOpenChange={(nextOpen) => !nextOpen && handleClose()}
                >
                    <DialogContent
                        onOpenAutoFocus={(e) => e.preventDefault()}
                        showCloseButton={false}
                        disableAnimation
                        className="w-[calc(100%-32px)] gap-0 overflow-hidden p-0 sm:max-w-243.75"
                        aria-describedby={undefined}
                    >
                        <DialogHeader>
                            <VisuallyHidden>
                                <DialogTitle>{tDialog("title")}</DialogTitle>
                            </VisuallyHidden>
                            {event ? (
                                <EventHeader
                                    id={eventId}
                                    event={event}
                                    modal
                                    onDeleteEvent={handleDeleteEvent}
                                    portalContainer={portalContainer}
                                />
                            ) : null}
                        </DialogHeader>
                        <div className="mx-auto no-scrollbar max-h-[80vh] w-full overflow-y-auto px-3 pt-18 pb-20 sm:max-w-180.75">
                            {content}
                        </div>
                    </DialogContent>
                </Dialog>
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

    return (
        <>
            <Drawer
                open={open}
                onOpenChange={(nextOpen) => !nextOpen && handleClose()}
            >
                <DrawerContent>{content}</DrawerContent>
            </Drawer>
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
})
