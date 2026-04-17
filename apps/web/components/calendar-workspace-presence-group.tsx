"use client"

import dayjs from "@/lib/dayjs"
import type { CalendarWorkspacePresenceMember } from "@/store/calendar-store.types"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import {
    Avatar,
    AvatarFallback,
    AvatarGroup,
    AvatarGroupCount,
    AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { useMemo } from "react"

const MAX_VISIBLE_MEMBERS = 4
const KOREAN_LOCALE = "ko"

function getPresenceFallbackLabel(displayName: string, isAnonymous: boolean) {
    if (isAnonymous) {
        return "익"
    }

    return displayName.trim().charAt(0).toUpperCase() || "?"
}

function getPresenceCursorLabel(
    cursor:
        | {
              date: string
              type: "cell" | "event"
              eventId?: string
          }
        | null
        | undefined,
    getEventTitle?: (eventId?: string) => string | null,
    selectedDate?: number,
    calendarTimezone?: string
) {
    if (!cursor) {
        return "캘린더 보는 중"
    }

    const cursorDate = calendarTimezone
        ? dayjs.tz(cursor.date, calendarTimezone)
        : dayjs(cursor.date)
    const myDate = selectedDate
        ? calendarTimezone
            ? dayjs.tz(selectedDate, calendarTimezone)
            : dayjs(selectedDate)
        : calendarTimezone
          ? dayjs().tz(calendarTimezone)
          : dayjs()
    const format =
        myDate.year() === cursorDate.year() ? "M월 D일" : "YY년 M월 D일"

    if (cursor.type === "event") {
        const eventTitle = getEventTitle?.(cursor.eventId)

        if (eventTitle) {
            return `${eventTitle} 확인 중`
        }

        return `${cursorDate.format(format)} 일정 확인 중`
    }

    return `${cursorDate.format(format)} 날짜 보는 중`
}

export function CalendarWorkspacePresenceGroup() {
    const my = useAuthStore((s) => s.user)
    const myUserId = my?.id ?? null
    const selectedDate = useCalendarStore((s) => s.selectedDate)
    const setSelectedDate = useCalendarStore((s) => s.setSelectedDate)
    const calendarTimezone = useCalendarStore((s) => s.calendarTimezone)
    const members = useCalendarStore(
        (state): CalendarWorkspacePresenceMember[] => state.workspacePresence
    )
    const events = useCalendarStore((state) => state.events)
    const isLoading = useCalendarStore(
        (state) => state.isWorkspacePresenceLoading
    )

    const myId =
        myUserId ??
        (typeof window !== "undefined"
            ? sessionStorage.getItem("calendar-workspace-anonymous-id")
            : null)

    const sortedMembers = useMemo(
        () =>
            [...members].sort((a, b) => {
                const aIsMe = myUserId ? a.userId === myUserId : a.id === myId
                const bIsMe = myUserId ? b.userId === myUserId : b.id === myId

                if (aIsMe !== bIsMe) {
                    return aIsMe ? -1 : 1
                }

                if (a.cursor?.type !== b.cursor?.type) {
                    return a.cursor?.type === "event" ? -1 : 1
                }

                return a.displayName.localeCompare(b.displayName, KOREAN_LOCALE)
            }),
        [members, myUserId, myId]
    )
    const eventTitleMap = useMemo(
        () =>
            new Map(
                events.map((event) => [
                    event.id,
                    event.title.trim() || "새 일정",
                ])
            ),
        [events]
    )
    const getEventTitle = useMemo(
        () => (eventId?: string) =>
            eventId ? (eventTitleMap.get(eventId) ?? null) : null,
        [eventTitleMap]
    )
    const visibleMembers = sortedMembers.slice(0, MAX_VISIBLE_MEMBERS)
    const hiddenCount = Math.max(0, sortedMembers.length - MAX_VISIBLE_MEMBERS)
    const title = sortedMembers.map((member) => member.displayName).join(", ")

    if (!isLoading && members.length === 0) {
        return null
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger>
                {isLoading && members.length === 0 ? (
                    <div className="flex size-8 items-center justify-center text-muted-foreground">
                        <Spinner
                            className="size-5"
                            aria-label="온라인 멤버 불러오는 중"
                        />
                    </div>
                ) : (
                    <div className="relative">
                        <AvatarGroup
                            className="mr-1"
                            aria-label="이 캘린더를 보고 있는 사람"
                            title={title}
                        >
                            {visibleMembers.map((member) => (
                                <Avatar key={member.id} size="sm">
                                    <AvatarImage
                                        src={member.avatarUrl ?? undefined}
                                        alt={member.displayName}
                                    />
                                    <AvatarFallback>
                                        {getPresenceFallbackLabel(
                                            member.displayName,
                                            member.isAnonymous
                                        )}
                                    </AvatarFallback>
                                </Avatar>
                            ))}
                            {hiddenCount > 0 && (
                                <AvatarGroupCount>
                                    +{hiddenCount}
                                </AvatarGroupCount>
                            )}
                        </AvatarGroup>
                        {isLoading && members.length > 0 && (
                            <div className="absolute top-0 left-0 flex size-4 h-full w-full items-center justify-center bg-background/45 text-muted-foreground">
                                <Spinner className="size-5" />
                            </div>
                        )}
                    </div>
                )}
            </DropdownMenuTrigger>
            {sortedMembers.length > 0 && (
                <DropdownMenuContent align="end" className="w-47">
                    <DropdownMenuLabel>온라인 멤버</DropdownMenuLabel>
                    {sortedMembers.map((user) => (
                        <DropdownMenuItem
                            key={user.id}
                            asChild
                            onClick={() => {
                                setSelectedDate(
                                    dayjs
                                        .tz(user.cursor?.date, calendarTimezone)
                                        .toDate()
                                )
                            }}
                        >
                            <div className="flex items-start gap-2 overflow-hidden">
                                <Avatar className="mt-1 size-6.5 shrink-0">
                                    <AvatarImage
                                        src={user.avatarUrl || undefined}
                                        alt={user.displayName}
                                    />
                                    <AvatarFallback
                                        className={cn(
                                            "text-xs",
                                            user.isAnonymous && "text-[10px]!"
                                        )}
                                    >
                                        {user.isAnonymous
                                            ? "익명"
                                            : user.displayName?.[0]?.toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-1 flex-col gap-1 overflow-hidden text-start">
                                    <div className="flex flex-1 items-center gap-1">
                                        <span className="flex-initial truncate text-sm font-medium tracking-tight [word-spacing:-1px]">
                                            {user.displayName}
                                        </span>
                                        {(myUserId
                                            ? user.userId === myUserId
                                            : myId === user.id) && (
                                            <Badge
                                                variant="outline"
                                                className="shrink-0 px-1.75 leading-normal"
                                            >
                                                나
                                            </Badge>
                                        )}
                                    </div>
                                    <span className="truncate text-xs tracking-tight text-muted-foreground [word-spacing:-0.5px]">
                                        {getPresenceCursorLabel(
                                            user.cursor,
                                            getEventTitle,
                                            selectedDate,
                                            calendarTimezone
                                        )}
                                    </span>
                                </div>
                            </div>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            )}
        </DropdownMenu>
    )
}
