"use client"

import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@workspace/ui/components/avatar"
import { CalendarIcon } from "lucide-react"
import type { NotificationAvatarSource } from "@/lib/notification/format"

interface NotificationAvatarProps {
    source: NotificationAvatarSource
    size?: "sm" | "md"
}

/**
 * 알림 아이템의 아바타.
 * type === "calendar" 이면 캘린더 아이콘 fallback,
 * type === "user" 이면 유저 이니셜 fallback.
 */
export function NotificationAvatar({ source, size = "md" }: NotificationAvatarProps) {
    const sizeClass = size === "sm" ? "size-7" : "size-9"

    return (
        <Avatar className={sizeClass}>
            <AvatarImage src={source.url ?? undefined} alt={source.name ?? ""} />
            <AvatarFallback className="text-xs">
                {source.type === "calendar" ? (
                    <CalendarIcon className="size-4" />
                ) : (
                    (source.name?.[0]?.toUpperCase() ?? "?")
                )}
            </AvatarFallback>
        </Avatar>
    )
}
