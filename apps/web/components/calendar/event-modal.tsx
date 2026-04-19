"use client"

import { useMediaQuery } from "@/hooks/use-media-query"
import { getCalendarBasePath } from "@/lib/calendar/routes"
import { usePathname, useRouter } from "next/navigation"
import * as React from "react"
import { startTransition } from "react"

import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@workspace/ui/components/dialog"
import { Drawer, DrawerContent } from "@workspace/ui/components/drawer"

import { EventPage } from "@/components/calendar/event-page"
import { useEventDeleteAction } from "@/hooks/use-event-delete-action"
import { useCalendarStore } from "@/store/useCalendarStore"
import { EventHeader } from "./event-header"

export const EventModal = React.memo(function EventModal({
    e,
}: {
    e?: string
}) {
    const router = useRouter()
    const pathname = usePathname()
    const isDesktop = useMediaQuery("(min-width: 768px)")

    const activeEventId = useCalendarStore((s) => s.activeEventId)
    const setActiveEventId = useCalendarStore((s) => s.setActiveEventId)
    const [isClosing, setIsClosing] = React.useState(false)
    const closeTimerRef = React.useRef<number | null>(null)
    const eventId = activeEventId ?? e
    const open = Boolean(eventId) && !isClosing
    const basePath = getCalendarBasePath(pathname)

    const event = useCalendarStore((s) =>
        eventId ? s.events.find((ev) => ev.id === eventId) : undefined
    )

    React.useEffect(() => {
        return () => {
            if (closeTimerRef.current) {
                window.clearTimeout(closeTimerRef.current)
            }
        }
    }, [])

    React.useEffect(() => {
        if (e) {
            setIsClosing(false)
            setActiveEventId(e)
            return
        }

        setIsClosing(false)
        setActiveEventId(undefined)
    }, [e, setActiveEventId])

    React.useEffect(() => {
        if (eventId && !event) {
            setActiveEventId(undefined)
            router.replace(basePath)
        }
    }, [basePath, eventId, event, router, setActiveEventId])

    const handleClose = () => {
        if (closeTimerRef.current) {
            window.clearTimeout(closeTimerRef.current)
        }

        setIsClosing(true)

        useCalendarStore.setState({
            selection: {
                isSelecting: false,
                start: null,
                end: null,
                anchor: null,
            },
        })

        closeTimerRef.current = window.setTimeout(() => {
            setActiveEventId(undefined)
            startTransition(() => {
                router.replace(basePath)
            })
        }, 150)
    }

    const handleDeleteEvent = useEventDeleteAction({
        eventId,
        onSuccess: () => {
            if (closeTimerRef.current) {
                window.clearTimeout(closeTimerRef.current)
            }
            setIsClosing(false)
            setActiveEventId(undefined)
            router.replace(basePath)
        },
    })

    if (!eventId || !event) return null

    const content = <EventPage modal eventId={eventId} />

    if (isDesktop) {
        return (
            <Dialog
                open={open}
                onOpenChange={(v) => !v && handleClose()}
                // modal={false}
            >
                {/* {open && (
                    <div
                        data-state={open ? "open" : "closed"}
                        className="fixed inset-0 isolate z-50 bg-black/45 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
                    ></div>
                )} */}
                <DialogContent
                    showCloseButton={false}
                    className="w-[calc(100%-32px)] gap-0 p-0 sm:max-w-243.75"
                    aria-describedby={undefined}
                >
                    <DialogHeader>
                        <VisuallyHidden>
                            <DialogTitle>일정</DialogTitle>
                        </VisuallyHidden>
                        <EventHeader modal onDeleteEvent={handleDeleteEvent} />
                    </DialogHeader>
                    <div className="mx-auto no-scrollbar max-h-[80vh] w-full overflow-y-auto px-3 pt-18 pb-20 sm:max-w-180.75">
                        {content}
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Drawer open={open} onOpenChange={(v) => !v && handleClose()}>
            <DrawerContent>{content}</DrawerContent>
        </Drawer>
    )
})
