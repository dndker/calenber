"use client"

import { useMediaQuery } from "@/hooks/use-media-query"
import {
    getCalendarBasePath,
    getCalendarEventPagePath,
} from "@/lib/calendar/routes"
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
import { useDeleteEvent } from "@/hooks/use-delete-event"
import { useCalendarStore } from "@/store/useCalendarStore"
import { Button } from "@workspace/ui/components/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Separator } from "@workspace/ui/components/separator"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import {
    ChevronLeft,
    ChevronRight,
    Ellipsis,
    LinkIcon,
    Maximize2,
    ShareIcon,
    Star,
    TrashIcon,
} from "lucide-react"

export const EventModal = React.memo(function EventModal({
    e,
}: {
    e?: string
}) {
    const router = useRouter()
    const pathname = usePathname()
    const isDesktop = useMediaQuery("(min-width: 768px)")
    const deleteEvent = useDeleteEvent()
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
            router.replace(basePath)
        }
    }, [basePath, eventId, event, router])

    if (!eventId || !event) return null

    const handleClose = () => {
        if (closeTimerRef.current) {
            window.clearTimeout(closeTimerRef.current)
        }

        setIsClosing(true)

        useCalendarStore.setState({
            selection: { isSelecting: false, start: null, end: null },
        })

        closeTimerRef.current = window.setTimeout(() => {
            setActiveEventId(undefined)
            startTransition(() => {
                router.replace(basePath)
            })
        }, 150)
    }

    const handleDeleteEvenet = async () => {
        const ok = await deleteEvent(eventId)

        if (ok) {
            if (closeTimerRef.current) {
                window.clearTimeout(closeTimerRef.current)
            }
            setIsClosing(false)
            setActiveEventId(undefined)
            router.replace(basePath)
        }
    }

    const content = <EventPage eventId={eventId} />

    if (isDesktop) {
        return (
            <Dialog
                open={open}
                onOpenChange={(v) => !v && handleClose()}
                // modal={false}
            >
                {open && (
                    <div
                        data-state={open ? "open" : "closed"}
                        className="fixed inset-0 isolate z-50 bg-black/45 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
                    ></div>
                )}
                <DialogContent
                    showCloseButton={false}
                    className="gap-0 p-0 sm:max-w-243.75"
                    aria-describedby={undefined}
                >
                    <DialogHeader>
                        <VisuallyHidden>
                            <DialogTitle>일정</DialogTitle>
                        </VisuallyHidden>
                        <div className="flex h-11 items-center justify-between px-3">
                            <div className="flex items-center gap-0.5">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            tabIndex={-1}
                                            variant="ghost"
                                            size="icon"
                                            className="size-6"
                                            onClick={() => {
                                                const calendarId =
                                                    basePath.split("/")[2]

                                                if (!calendarId) {
                                                    return
                                                }

                                                router.push(
                                                    getCalendarEventPagePath(
                                                        calendarId,
                                                        eventId
                                                    )
                                                )
                                            }}
                                        >
                                            <Maximize2 className="size-3.75 rotate-90 text-muted-foreground" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="text-sm font-medium">
                                            전체 페이지로 열기
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                                <Separator
                                    orientation="vertical"
                                    className="mx-1 h-3.5 w-px self-center!"
                                />
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            tabIndex={-1}
                                            variant="ghost"
                                            size="icon"
                                            className="size-6"
                                        >
                                            <ChevronLeft className="size-5 text-muted-foreground" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="text-sm font-medium">
                                            이전 일정
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            tabIndex={-1}
                                            variant="ghost"
                                            size="icon"
                                            className="size-6"
                                        >
                                            <ChevronRight className="size-5 text-muted-foreground" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="text-sm font-medium">
                                            다음 일정
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <div className="flex items-center gap-1">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            tabIndex={-1}
                                            variant="ghost"
                                            size="icon"
                                            className="size-7"
                                        >
                                            <Star className="size-4.25 text-muted-foreground" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="text-sm font-medium">
                                            즐겨찾기 추가
                                        </p>
                                    </TooltipContent>
                                </Tooltip>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            tabIndex={-1}
                                            variant="ghost"
                                            size="icon"
                                            className="size-7"
                                        >
                                            <Ellipsis className="size-5.5 text-muted-foreground" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        className="w-auto"
                                    >
                                        <DropdownMenuGroup>
                                            <DropdownMenuItem>
                                                <LinkIcon />
                                                링크 복사
                                            </DropdownMenuItem>
                                            <DropdownMenuItem>
                                                <ShareIcon />
                                                공유
                                            </DropdownMenuItem>
                                        </DropdownMenuGroup>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuGroup>
                                            <DropdownMenuItem
                                                variant="destructive"
                                                onClick={handleDeleteEvenet}
                                            >
                                                <TrashIcon />
                                                일정 삭제
                                            </DropdownMenuItem>
                                        </DropdownMenuGroup>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
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
