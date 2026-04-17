"use client"

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

export function CalendarEventPresenceGroup({ eventId }: { eventId: string }) {
    const my = useAuthStore((state) => state.user)
    const myId =
        my?.id ??
        (typeof window !== "undefined"
            ? sessionStorage.getItem("calendar-workspace-anonymous-id")
            : null)
    const members = useCalendarStore((state) => state.workspacePresence)

    const eventMembers = useMemo(
        () =>
            members
                .filter(
                    (member): member is CalendarWorkspacePresenceMember & {
                        cursor: NonNullable<CalendarWorkspacePresenceMember["cursor"]>
                    } =>
                        member.cursor?.type === "event" &&
                        member.cursor.eventId === eventId
                )
                .sort((a, b) =>
                    a.displayName.localeCompare(b.displayName, KOREAN_LOCALE)
                ),
        [eventId, members]
    )

    if (eventMembers.length === 0) {
        return null
    }

    const visibleMembers = eventMembers.slice(0, MAX_VISIBLE_MEMBERS)
    const hiddenCount = Math.max(0, eventMembers.length - MAX_VISIBLE_MEMBERS)
    const title = eventMembers.map((member) => member.displayName).join(", ")

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-2 py-1"
                    title={title}
                >
                    <span className="text-xs font-medium text-muted-foreground">
                        보고 있는 사람
                    </span>
                    <AvatarGroup className="mr-0.5">
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
                            <AvatarGroupCount>+{hiddenCount}</AvatarGroupCount>
                        )}
                    </AvatarGroup>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>이 일정 보는 사람</DropdownMenuLabel>
                {eventMembers.map((member) => (
                    <DropdownMenuItem key={member.id} asChild>
                        <div className="flex items-center gap-2 overflow-hidden">
                            <Avatar size="sm" className="shrink-0">
                                <AvatarImage
                                    src={member.avatarUrl ?? undefined}
                                    alt={member.displayName}
                                />
                                <AvatarFallback
                                    className={cn(
                                        "text-xs",
                                        member.isAnonymous && "text-[10px]!"
                                    )}
                                >
                                    {member.isAnonymous
                                        ? "익명"
                                        : member.displayName
                                              ?.charAt(0)
                                              ?.toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex min-w-0 flex-1 items-center gap-1">
                                <span className="truncate text-sm font-medium">
                                    {member.displayName}
                                </span>
                                {(my?.id
                                    ? member.userId === my.id
                                    : myId === member.id) && (
                                    <Badge
                                        variant="outline"
                                        className="shrink-0 px-1.75 leading-normal"
                                    >
                                        나
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
