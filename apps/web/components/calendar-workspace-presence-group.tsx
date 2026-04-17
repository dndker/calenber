"use client"

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

const MAX_VISIBLE_MEMBERS = 4

function getPresenceFallbackLabel(displayName: string, isAnonymous: boolean) {
    if (isAnonymous) {
        return "익"
    }

    return displayName.trim().charAt(0).toUpperCase() || "?"
}

export function CalendarWorkspacePresenceGroup() {
    const my = useAuthStore((s) => s.user)
    const members = useCalendarStore((state) => state.workspacePresence)

    if (members.length === 0) {
        return null
    }

    const visibleMembers = members.slice(0, MAX_VISIBLE_MEMBERS)
    const hiddenCount = Math.max(0, members.length - MAX_VISIBLE_MEMBERS)
    const title = members.map((member) => member.displayName).join(", ")

    return (
        <DropdownMenu>
            <DropdownMenuTrigger>
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
                        <AvatarGroupCount>+{hiddenCount}</AvatarGroupCount>
                    )}
                </AvatarGroup>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-45">
                <DropdownMenuLabel>온라인 멤버</DropdownMenuLabel>
                {members.map((user) => (
                    <DropdownMenuItem key={user.id} asChild>
                        <div className="flex items-center gap-2 overflow-hidden">
                            <Avatar size="sm" className="shrink-0">
                                <AvatarImage
                                    src={user.avatarUrl || undefined}
                                    alt={user.displayName}
                                />
                                <AvatarFallback className="text-xs">
                                    {user.displayName?.[0]?.toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-1 flex-col gap-1 overflow-hidden text-start">
                                <div className="flex flex-1 items-center gap-1">
                                    <span className="flex-initial truncate text-sm font-medium">
                                        {user.displayName}
                                    </span>
                                    {my?.name === user.displayName && (
                                        <Badge
                                            variant="outline"
                                            className="shrink-0 px-1.75 leading-normal"
                                        >
                                            나
                                        </Badge>
                                    )}
                                </div>
                                {/* <span className="max-w-[20ch] truncate text-xs text-muted-foreground">
                                    {user.displayName}
                                </span> */}
                            </div>
                        </div>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
