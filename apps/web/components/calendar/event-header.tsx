import { EventCollaboratorsHoverCard } from "@/components/calendar/event-collaborators-hover-card"
import { EventHistoryDrawer } from "@/components/calendar/event-history-drawer"
import { useAdjacentEvents } from "@/hooks/use-adjacent-events"
import { useCopyCalendarEventLink } from "@/hooks/use-copy-calendar-event-link"
import {
    getCachedCalendarEventHistory,
    loadCalendarEventHistory,
    warmCalendarEventHistory,
    type CalendarEventHistoryItem,
} from "@/lib/calendar/event-history"
import { navigateCalendarModal } from "@/lib/calendar/modal-navigation"
import { getCalendarModalOpenPath } from "@/lib/calendar/modal-route"
import {
    canDeleteCalendarEvent,
    canToggleCalendarEventLock,
} from "@/lib/calendar/permissions"
import {
    getCalendarBasePath,
    getCalendarEventPagePath,
} from "@/lib/calendar/routes"
import type { CalendarEvent } from "@/store/calendar-store.types"
import { useAuthStore } from "@/store/useAuthStore"
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
import { Switch } from "@workspace/ui/components/switch"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    EllipsisIcon,
    HistoryIcon,
    LinkIcon,
    LockIcon,
    LockOpenIcon,
    Maximize2Icon,
    Minimize2Icon,
    ShareIcon,
    StarIcon,
    TrashIcon,
} from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { memo, useEffect, useRef, useState } from "react"
import { CalendarEventPresenceGroup } from "./calendar-event-presence-group"

type EventHeaderProps = {
    modal?: boolean
    id?: string
    event?: CalendarEvent | null
    onDeleteEvent: () => void
    portalContainer?: HTMLElement | null
}

export const EventHeader = memo(function EventHeader({
    id,
    event: eventProp,
    modal = false,
    onDeleteEvent,
    portalContainer,
}: EventHeaderProps) {
    const router = useRouter()
    const pathname = usePathname()
    const basePath = getCalendarBasePath(pathname)

    const user = useAuthStore((s) => s.user)

    const activeEventId = useCalendarStore((s) => s.activeEventId)
    const setActiveEventId = useCalendarStore((s) => s.setActiveEventId)
    const setViewEvent = useCalendarStore((s) => s.setViewEvent)

    const updateEvent = useCalendarStore((s) => s.updateEvent)
    const { copyEventLink } = useCopyCalendarEventLink()

    const activeCalendar = useCalendarStore((s) => s.activeCalendar)
    const activeCalendarMembership = useCalendarStore(
        (s) => s.activeCalendarMembership
    )

    const calendarId = activeCalendar?.id || basePath.split("/")[2]

    const eventId = id ? id : (activeEventId ?? undefined)
    const storeEvent = useCalendarStore((s) =>
        eventId ? s.events.find((ev) => ev.id === eventId) : undefined
    )
    const event = eventProp ?? storeEvent
    const [isHistoryOpen, setIsHistoryOpen] = useState(false)
    const [historyState, setHistoryState] = useState<{
        eventId?: string
        history: CalendarEventHistoryItem[]
    }>(() => ({
        eventId,
        history: eventId ? (getCachedCalendarEventHistory(eventId) ?? []) : [],
    }))
    const lastHistoryVersionRef = useRef<string | null>(null)
    const pendingOpenHistoryRef = useRef(false)

    const tooltipSide = modal ? "top" : "bottom"

    const { prevEvent, nextEvent, hasPrev, hasNext } = useAdjacentEvents(
        eventId!
    )

    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const prefetchedHistory =
        eventId == null
            ? []
            : historyState.eventId === eventId
              ? historyState.history
              : (getCachedCalendarEventHistory(eventId) ?? [])

    useEffect(() => {
        if (!eventId) {
            return
        }

        if (typeof window === "undefined") {
            return
        }

        let cancelled = false

        const warm = () => {
            void loadCalendarEventHistory(eventId)
                .then((nextHistory) => {
                    if (!cancelled) {
                        setHistoryState({
                            eventId,
                            history: nextHistory,
                        })
                    }
                })
                .catch(() => {})
        }

        if ("requestIdleCallback" in window) {
            const idleId = window.requestIdleCallback(warm, {
                timeout: 1200,
            })

            return () => {
                cancelled = true
                window.cancelIdleCallback(idleId)
            }
        }

        const timeoutId = globalThis.setTimeout(warm, 350)
        return () => {
            cancelled = true
            globalThis.clearTimeout(timeoutId)
        }
    }, [eventId])

    useEffect(() => {
        if (!eventId || !event) {
            lastHistoryVersionRef.current = null
            return
        }

        const nextVersionKey = `${eventId}:${event.updatedAt}`

        if (!lastHistoryVersionRef.current) {
            lastHistoryVersionRef.current = nextVersionKey
            return
        }

        if (lastHistoryVersionRef.current === nextVersionKey) {
            return
        }

        lastHistoryVersionRef.current = nextVersionKey

        let cancelled = false

        void loadCalendarEventHistory(eventId, { force: true })
            .then((nextHistory) => {
                if (!cancelled) {
                    setHistoryState({
                        eventId,
                        history: nextHistory,
                    })
                }
            })
            .catch(() => {})

        return () => {
            cancelled = true
        }
    }, [event, eventId])

    useEffect(() => {
        if (isDropdownOpen || !pendingOpenHistoryRef.current) {
            return
        }

        pendingOpenHistoryRef.current = false

        if (
            typeof document !== "undefined" &&
            document.activeElement instanceof HTMLElement
        ) {
            document.activeElement.blur()
        }

        const frameId = globalThis.requestAnimationFrame(() => {
            setIsHistoryOpen(true)
        })

        return () => {
            globalThis.cancelAnimationFrame(frameId)
        }
    }, [isDropdownOpen])

    if (!eventId || !event) return null

    const handleOpenHistory = () => {
        pendingOpenHistoryRef.current = true
        setIsDropdownOpen(false)
    }

    const canDelete =
        activeCalendar?.id === "demo" ||
        canDeleteCalendarEvent(event, activeCalendarMembership, user?.id)
    const canToggleLock =
        activeCalendar?.id === "demo" ||
        canToggleCalendarEventLock(event, activeCalendarMembership, user?.id)

    const handleEventControls = (eventId?: string) => {
        if (!calendarId || !eventId) return false

        if (modal) {
            const targetEvent =
                prevEvent?.id === eventId
                    ? prevEvent
                    : nextEvent?.id === eventId
                      ? nextEvent
                      : null

            setActiveEventId(eventId)
            setViewEvent(targetEvent)
            navigateCalendarModal(
                getCalendarModalOpenPath({
                    pathname: basePath,
                    eventId,
                })
            )
            return
        }

        router.push(getCalendarEventPagePath(calendarId, eventId))
    }

    return (
        <div
            className={cn(
                "cb-event-header relative flex h-12 items-center justify-between px-3",
                !modal && "absolute top-0 left-0 w-full"
            )}
        >
            <div className="absolute top-1/2 left-1/2 -translate-1/2">
                <CalendarEventPresenceGroup eventId={event.id} />
            </div>

            <div className="flex items-center gap-0.5">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            tabIndex={-1}
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            onClick={() => {
                                if (!calendarId) {
                                    return
                                }

                                if (modal) {
                                    router.push(
                                        getCalendarEventPagePath(
                                            calendarId,
                                            eventId
                                        )
                                    )
                                } else {
                                    setActiveEventId(eventId)
                                    setViewEvent(event)
                                    navigateCalendarModal(
                                        getCalendarModalOpenPath({
                                            pathname: basePath,
                                            eventId,
                                        })
                                    )
                                }
                            }}
                        >
                            {modal ? (
                                <Maximize2Icon className="size-3.75 rotate-90 text-muted-foreground" />
                            ) : (
                                <Minimize2Icon className="size-3.75 rotate-90 text-muted-foreground" />
                            )}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side={tooltipSide}>
                        <p className="text-sm font-medium">
                            {modal
                                ? "전체 페이지로 열기"
                                : "캘린더 페이지로 열기"}
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
                            disabled={!hasPrev}
                            onClick={() => handleEventControls(prevEvent?.id)}
                        >
                            <ChevronLeftIcon className="size-5 text-muted-foreground" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side={tooltipSide}>
                        <p className="text-sm font-medium">이전 일정</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            tabIndex={-1}
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            disabled={!hasNext}
                            onClick={() => handleEventControls(nextEvent?.id)}
                        >
                            <ChevronRightIcon className="size-5 text-muted-foreground" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side={tooltipSide}>
                        <p className="text-sm font-medium">다음 일정</p>
                    </TooltipContent>
                </Tooltip>
            </div>
            <div className="flex items-center gap-1.25">
                {activeCalendarMembership.isMember && (
                    <EventCollaboratorsHoverCard
                        event={event}
                        history={prefetchedHistory}
                    />
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
                        <TooltipContent side={tooltipSide}>
                            <p className="text-sm font-medium">즐겨찾기 추가</p>
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
                            <TooltipContent side={tooltipSide}>
                                <p className="text-sm font-medium">
                                    이 일정은 수정할 수 없습니다.
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    )}

                <DropdownMenu
                    modal={false}
                    open={isDropdownOpen}
                    onOpenChange={setIsDropdownOpen}
                >
                    <DropdownMenuTrigger asChild>
                        <Button
                            tabIndex={-1}
                            variant="ghost"
                            size="icon"
                            className="size-7"
                        >
                            <EllipsisIcon className="size-5.5 text-muted-foreground" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        className="w-auto"
                        onCloseAutoFocus={(closeEvent) => {
                            closeEvent.preventDefault()
                        }}
                    >
                        <DropdownMenuGroup>
                            <DropdownMenuItem
                                onClick={() => {
                                    if (!calendarId) {
                                        return
                                    }

                                    void copyEventLink({
                                        calendarId,
                                        eventId,
                                        modal,
                                    })
                                }}
                            >
                                <LinkIcon />
                                링크 복사
                            </DropdownMenuItem>
                            {activeCalendarMembership.isMember && (
                                <DropdownMenuItem>
                                    <ShareIcon />
                                    공유
                                </DropdownMenuItem>
                            )}
                            {canToggleLock && (
                                <DropdownMenuItem
                                    className="min-w-40 gap-3"
                                    onSelect={(event) => {
                                        event.preventDefault()
                                    }}
                                    onClick={() => {
                                        updateEvent(event.id, {
                                            isLocked: !event.isLocked,
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
                            {activeCalendarMembership.isMember && (
                                <DropdownMenuItem
                                    onPointerEnter={() => {
                                        warmCalendarEventHistory(event.id)
                                    }}
                                    onSelect={(e) => {
                                        e.preventDefault()

                                        const target =
                                            e.currentTarget as HTMLElement
                                        target.blur()

                                        handleOpenHistory()
                                    }}
                                >
                                    <HistoryIcon />
                                    일정 기록
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
                                            void onDeleteEvent()
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
                <EventHistoryDrawer
                    eventId={event.id}
                    open={isHistoryOpen}
                    onOpenChange={setIsHistoryOpen}
                    portalContainer={portalContainer}
                    preloadedHistory={prefetchedHistory}
                />
            </div>
        </div>
    )
})
