import {
    canDeleteCalendarEvent,
    canToggleCalendarEventLock,
} from "@/lib/calendar/permissions"
import {
    getCalendarBasePath,
    getCalendarEventModalPath,
    getCalendarEventPagePath,
} from "@/lib/calendar/routes"
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
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@workspace/ui/components/hover-card"
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
import { memo } from "react"
import { CalendarEventPresenceGroup } from "./calendar-event-presence-group"

type EventHeaderProps = {
    modal?: boolean
    id?: string
    onDeleteEvent: () => void
}

export const EventHeader = memo(function EventHeader({
    id,
    modal = false,
    onDeleteEvent,
}: EventHeaderProps) {
    const router = useRouter()
    const pathname = usePathname()
    const basePath = getCalendarBasePath(pathname)

    const user = useAuthStore((s) => s.user)

    const activeEventId = useCalendarStore((s) => s.activeEventId)

    const updateEvent = useCalendarStore((s) => s.updateEvent)

    const activeCalendar = useCalendarStore((s) => s.activeCalendar)
    const activeCalendarMembership = useCalendarStore(
        (s) => s.activeCalendarMembership
    )

    const eventId = id ? id : (activeEventId ?? undefined)
    const event = useCalendarStore((s) =>
        eventId ? s.events.find((ev) => ev.id === eventId) : undefined
    )

    const tooltipSide = modal ? "top" : "bottom"

    if (!eventId || !event) return null

    const canDelete =
        activeCalendar?.id === "demo" ||
        canDeleteCalendarEvent(event, activeCalendarMembership, user?.id)
    const canToggleLock =
        activeCalendar?.id === "demo" ||
        canToggleCalendarEventLock(event, activeCalendarMembership, user?.id)

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
                                const calendarId = basePath.split("/")[2]

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
                                    router.push(
                                        getCalendarEventModalPath(
                                            calendarId,
                                            eventId
                                        )
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
                {event?.author && activeCalendarMembership.isMember && (
                    <HoverCard openDelay={10} closeDelay={100}>
                        <HoverCardTrigger className="mr-0.5">
                            <AvatarGroup>
                                <Avatar className="size-5.75">
                                    <AvatarImage
                                        src={
                                            event.author.avatarUrl ?? undefined
                                        }
                                        alt={event.author.name ?? "작성자"}
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
                                            event.author.avatarUrl ?? undefined
                                        }
                                        alt={event.author.name ?? "작성자"}
                                    />
                                    <AvatarFallback>
                                        {event.author.name?.[0]?.toUpperCase() ??
                                            "?"}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex min-w-0 flex-col gap-0.5">
                                    <div className="truncate font-medium text-primary">
                                        {event.author.name ?? "이름 없음"}
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

                <DropdownMenu>
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
                    <DropdownMenuContent align="end" className="w-auto">
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
            </div>
        </div>
    )
})
