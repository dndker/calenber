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
import { useEventDeleteAction } from "@/hooks/use-event-delete-action"
import { formatRelativeTime } from "@/lib/dayjs"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import {
    Avatar,
    AvatarFallback,
    AvatarGroup,
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
import { Switch } from "@workspace/ui/components/switch"
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
    StarIcon,
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
            selection: { isSelecting: false, start: null, end: null },
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

    const canDelete =
        activeCalendar?.id === "demo" ||
        canDeleteCalendarEvent(event, activeCalendarMembership, user?.id)
    const canToggleLock =
        activeCalendar?.id === "demo" ||
        canToggleCalendarEventLock(event, activeCalendarMembership, user?.id)

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
                                {event?.author &&
                                    activeCalendarMembership.isMember && (
                                        <HoverCard
                                            openDelay={10}
                                            closeDelay={100}
                                        >
                                            <HoverCardTrigger className="mr-0.5">
                                                <AvatarGroup>
                                                    <Avatar className="size-5.75">
                                                        <AvatarImage
                                                            src={
                                                                event.author
                                                                    .avatarUrl ??
                                                                undefined
                                                            }
                                                            alt={
                                                                event.author
                                                                    .name ??
                                                                "작성자"
                                                            }
                                                        />
                                                        <AvatarFallback>
                                                            {event.author.name?.[0]?.toUpperCase() ??
                                                                "?"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                </AvatarGroup>
                                            </HoverCardTrigger>
                                            <HoverCardContent
                                                className="flex w-auto min-w-44 flex-col p-0! px-3 shadow-sm"
                                                align="end"
                                            >
                                                <div className="px-3 pt-2 text-xs font-medium text-muted-foreground">
                                                    관련 작업자
                                                </div>
                                                <div className="flex gap-2.5 px-3 py-2.5 text-sm text-muted-foreground">
                                                    <Avatar className="size-6">
                                                        <AvatarImage
                                                            src={
                                                                event.author
                                                                    .avatarUrl ??
                                                                undefined
                                                            }
                                                            alt={
                                                                event.author
                                                                    .name ??
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
                                                            {event.author
                                                                .name ??
                                                                "이름 없음"}
                                                        </div>
                                                        {event.author.email && (
                                                            <div
                                                                className="truncate text-xs"
                                                                suppressHydrationWarning
                                                            >
                                                                {formatRelativeTime(
                                                                    event.updatedAt
                                                                )}{" "}
                                                                수정
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </HoverCardContent>
                                        </HoverCard>
                                    )}

                                {activeCalendarMembership.isMember && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                tabIndex={-1}
                                                variant="ghost"
                                                size="icon"
                                                className="size-7"
                                            >
                                                <StarIcon className="size-4.25 text-muted-foreground" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="text-sm font-medium">
                                                즐겨찾기 추가
                                            </p>
                                        </TooltipContent>
                                    </Tooltip>
                                )}

                                {event?.isLocked &&
                                    activeCalendarMembership.isMember &&
                                    user?.id !== event?.authorId && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    tabIndex={-1}
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-7"
                                                >
                                                    <LockIcon className="size-4.25 text-muted-foreground" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p className="text-sm font-medium">
                                                    이 일정은 수정할 수
                                                    없습니다.
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
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
                                                    className="min-w-40 gap-3"
                                                    onSelect={(event) => {
                                                        event.preventDefault()
                                                    }}
                                                    onClick={() => {
                                                        updateEvent(event.id, {
                                                            isLocked:
                                                                !event.isLocked,
                                                        })
                                                    }}
                                                >
                                                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                                        {event.isLocked ? (
                                                            <LockIcon />
                                                        ) : (
                                                            <LockOpenIcon />
                                                        )}
                                                        <div className="flex min-w-0 flex-1 flex-col">
                                                            일정 잠금
                                                        </div>
                                                    </div>
                                                    <Switch
                                                        size="sm"
                                                        checked={event.isLocked}
                                                        aria-label="일정 수정 잠금"
                                                    />
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuGroup>
                                        {canDelete && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuGroup>
                                                    <DropdownMenuItem
                                                        variant="destructive"
                                                        onClick={() => {
                                                            void handleDeleteEvent()
                                                        }}
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
