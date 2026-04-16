"use client"

import { useMediaQuery } from "@/hooks/use-media-query"
import {
    canDeleteCalendarEvent,
    canToggleCalendarEventLock,
} from "@/lib/calendar/permissions"
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
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@workspace/ui/components/hover-card"

import { EventPage } from "@/components/calendar/event-page"
import { useDeleteEvent } from "@/hooks/use-delete-event"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@workspace/ui/components/avatar"
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
    LockIcon,
    LockOpenIcon,
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
    const user = useAuthStore((s) => s.user)
    const activeCalendar = useCalendarStore((s) => s.activeCalendar)
    const activeCalendarMembership = useCalendarStore(
        (s) => s.activeCalendarMembership
    )
    const activeEventId = useCalendarStore((s) => s.activeEventId)
    const setActiveEventId = useCalendarStore((s) => s.setActiveEventId)
    const updateEvent = useCalendarStore((s) => s.updateEvent)
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

    const canDelete =
        activeCalendar?.id === "demo" ||
        canDeleteCalendarEvent(event, activeCalendarMembership, user?.id)
    const canToggleLock =
        activeCalendar?.id === "demo" ||
        canToggleCalendarEventLock(event, activeCalendarMembership, user?.id)

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
                            <div className="flex items-center gap-1.25">
                                {activeCalendarMembership.isMember && (
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
                                )}

                                {event?.author &&
                                    activeCalendarMembership.isMember && (
                                        <HoverCard
                                            openDelay={10}
                                            closeDelay={100}
                                        >
                                            <HoverCardTrigger>
                                                <Avatar className="size-5.75">
                                                    <AvatarImage
                                                        src={
                                                            event.author
                                                                .avatarUrl ??
                                                            undefined
                                                        }
                                                        alt={
                                                            event.author.name ??
                                                            "작성자"
                                                        }
                                                    />
                                                    <AvatarFallback>
                                                        {event.author.name?.[0]?.toUpperCase() ??
                                                            "?"}
                                                    </AvatarFallback>
                                                </Avatar>
                                            </HoverCardTrigger>
                                            <HoverCardContent
                                                className="flex w-auto items-center gap-2.5 px-3 text-sm text-muted-foreground shadow-sm"
                                                align="end"
                                            >
                                                <Avatar className="size-9">
                                                    <AvatarImage
                                                        src={
                                                            event.author
                                                                .avatarUrl ??
                                                            undefined
                                                        }
                                                        alt={
                                                            event.author.name ??
                                                            "작성자"
                                                        }
                                                    />
                                                    <AvatarFallback>
                                                        {event.author.name?.[0]?.toUpperCase() ??
                                                            "?"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex min-w-0 flex-col gap-0.5">
                                                    <div className="truncate font-medium text-primary">
                                                        {event.author.name ??
                                                            "이름 없음"}
                                                    </div>
                                                    {event.author.email && (
                                                        <div className="truncate text-xs">
                                                            {event.author.email}
                                                        </div>
                                                    )}
                                                </div>
                                            </HoverCardContent>
                                        </HoverCard>
                                    )}

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
                                            {canToggleLock && (
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        updateEvent(event.id, {
                                                            isLocked:
                                                                !event.isLocked,
                                                        })
                                                    }}
                                                >
                                                    {event.isLocked ? (
                                                        <LockOpenIcon />
                                                    ) : (
                                                        <LockIcon />
                                                    )}
                                                    {event.isLocked
                                                        ? "잠금 해제"
                                                        : "수정 잠금"}
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuGroup>
                                        {canDelete && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuGroup>
                                                    <DropdownMenuItem
                                                        variant="destructive"
                                                        onClick={
                                                            handleDeleteEvenet
                                                        }
                                                    >
                                                        <TrashIcon />
                                                        일정 삭제
                                                    </DropdownMenuItem>
                                                </DropdownMenuGroup>
                                            </>
                                        )}
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
