"use client"

import {
    AvatarGroupDropdown,
    AvatarGroupDropdownPreview,
    getAvatarGroupBadge,
    getAvatarGroupFallbackLabel,
} from "@/components/calendar/avatar-group-dropdown"
import type { CalendarWorkspacePresenceMember } from "@/store/calendar-store.types"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import { EyeIcon } from "lucide-react"
import { useMemo } from "react"

const MAX_VISIBLE_MEMBERS = 4
const KOREAN_LOCALE = "ko"

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

    const items = eventMembers.map((member) => {
        const isMe = my?.id ? member.userId === my.id : myId === member.id

        return {
            id: member.id,
            name: member.displayName,
            avatarUrl: member.avatarUrl,
            avatarFallback: getAvatarGroupFallbackLabel(
                member.displayName,
                member.isAnonymous
            ),
            badge: isMe ? getAvatarGroupBadge("나") : undefined,
        }
    })

    return (
        <AvatarGroupDropdown
            items={items}
            align="center"
            contentClassName="min-w-47"
            rowClassName="items-center"
            triggerAsChild
            trigger={
                <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border bg-muted/40 py-1 pr-1.25 pl-2"
                    title={items.map((member) => member.name).join(", ")}
                >
                    <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <EyeIcon className="size-4" />
                        함께 보고 있는 멤버 {eventMembers.length - 1}명
                    </span>
                    <AvatarGroupDropdownPreview
                        items={items}
                        maxVisibleAvatars={MAX_VISIBLE_MEMBERS}
                        avatarClassName="size-5"
                    />
                </button>
            }
        />
    )
}
