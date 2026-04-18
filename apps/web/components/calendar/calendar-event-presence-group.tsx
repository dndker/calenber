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
    DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"
import { EyeIcon } from "lucide-react"
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
    const myUserId = my?.id ?? null
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
                    (
                        member
                    ): member is CalendarWorkspacePresenceMember & {
                        cursor: NonNullable<
                            CalendarWorkspacePresenceMember["cursor"]
                        >
                    } =>
                        member.cursor?.type === "event" &&
                        member.cursor.eventId === eventId
                )
                .sort((a, b) => {
                    const aIsMe = myUserId
                        ? a.userId === myUserId
                        : a.id === myId
                    const bIsMe = myUserId
                        ? b.userId === myUserId
                        : b.id === myId

                    if (aIsMe !== bIsMe) {
                        return aIsMe ? -1 : 1
                    }

                    if (a.cursor?.type !== b.cursor?.type) {
                        return a.cursor?.type === "event" ? -1 : 1
                    }

                    return a.displayName.localeCompare(
                        b.displayName,
                        KOREAN_LOCALE
                    )
                }),
        [eventId, members, myId, myUserId]
    )

    if (eventMembers.length < 2) {
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
                    className="inline-flex items-center gap-2 rounded-full border bg-muted/40 py-1 pr-1.25 pl-2"
                    title={title}
                >
                    <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <EyeIcon className="size-4" />
                        함께 보고 있는 멤버 {eventMembers.length - 1}명
                    </span>
                    <AvatarGroup>
                        {visibleMembers.map((member) => (
                            <Avatar key={member.id} className="size-5">
                                <AvatarImage
                                    src={member.avatarUrl ?? undefined}
                                    alt={member.displayName}
                                />
                                <AvatarFallback className="text-xs">
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
            <DropdownMenuContent align="center" className="w-auto min-w-47">
                {/* <DropdownMenuLabel>이 일정을 보는 멤버</DropdownMenuLabel> */}
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
