"use client"

import { useRelativeTime } from "@/hooks/use-relative-time"
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
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { cn } from "@workspace/ui/lib/utils"
import type { ReactNode } from "react"

const DEFAULT_MAX_VISIBLE_AVATARS = 4

type AvatarGroupDropdownItem = {
    id: string
    name: string
    avatarUrl?: string | null
    avatarFallback?: string
    badge?: ReactNode
    email?: string | null
    time?: ReactNode
    timeValue?: string | Date | number | null
    onSelect?: () => void
    disabled?: boolean
    isAnonymous?: boolean
}

type AvatarGroupDropdownProps = {
    items: AvatarGroupDropdownItem[]
    trigger: ReactNode
    label?: ReactNode
    align?: "start" | "center" | "end"
    contentClassName?: string
    avatarClassName?: string
    rowClassName?: string
    triggerAsChild?: boolean
    onTriggerPointerEnter?: () => void
}

function AvatarGroupDropdownTime({
    time,
    timeValue,
}: {
    time?: ReactNode
    timeValue?: string | Date | number | null
}) {
    const relativeTime = useRelativeTime(timeValue, { clampFuture: true })

    if (time != null) {
        return (
            <span className="truncate text-xs text-muted-foreground">
                {time}
            </span>
        )
    }

    if (!timeValue || !relativeTime) {
        return null
    }

    return (
        <span
            className="truncate text-xs text-muted-foreground"
            suppressHydrationWarning
        >
            {relativeTime}
        </span>
    )
}

function AvatarGroupDropdownRow({
    item,
    avatarClassName,
    rowClassName,
}: {
    item: AvatarGroupDropdownItem
    avatarClassName?: string
    rowClassName?: string
}) {
    const avatarFallback =
        item.avatarFallback ?? item.name.trim().charAt(0).toUpperCase()

    return (
        <DropdownMenuItem
            asChild
            disabled={item.disabled}
            className="py-1.5"
            onSelect={() => {
                if (!item.onSelect || item.disabled) {
                    return
                }

                item.onSelect()
            }}
        >
            <div
                className={cn(
                    "flex items-start gap-2 overflow-hidden",
                    rowClassName
                )}
            >
                <Avatar
                    className={cn("mt-0.5 size-6.5 shrink-0", avatarClassName)}
                >
                    <AvatarImage
                        src={item.avatarUrl ?? undefined}
                        alt={item.name}
                    />
                    <AvatarFallback
                        className={cn(
                            "text-xs",
                            item.isAnonymous && "text-[9px] tracking-tight"
                        )}
                    >
                        {avatarFallback || "?"}
                    </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden text-start">
                    <div className="flex items-center gap-1">
                        <span className="truncate text-sm font-medium tracking-tight [word-spacing:-1px]">
                            {item.name}
                        </span>
                        {item.badge ? item.badge : null}
                    </div>
                    {item.email ? (
                        <span className="truncate text-xs text-muted-foreground">
                            {item.email}
                        </span>
                    ) : null}
                    <AvatarGroupDropdownTime
                        time={item.time}
                        timeValue={item.timeValue}
                    />
                </div>
            </div>
        </DropdownMenuItem>
    )
}

export function getAvatarGroupFallbackLabel(
    displayName: string,
    isAnonymous = false
) {
    if (isAnonymous) {
        return "Anon"
    }

    return displayName.trim().charAt(0).toUpperCase() || "?"
}

export function getAvatarGroupBadge(label: string) {
    return (
        <Badge variant="outline" className="shrink-0 px-1.75 leading-[normal]">
            {label}
        </Badge>
    )
}

export function AvatarGroupDropdown({
    items,
    trigger,
    label,
    align = "end",
    contentClassName,
    avatarClassName,
    rowClassName,
    triggerAsChild = false,
    onTriggerPointerEnter,
}: AvatarGroupDropdownProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                asChild={triggerAsChild}
                onPointerEnter={onTriggerPointerEnter}
            >
                {trigger}
            </DropdownMenuTrigger>
            {items.length > 0 ? (
                <DropdownMenuContent
                    align={align}
                    className={cn(
                        "w-auto min-w-56 overflow-hidden p-0",
                        contentClassName
                    )}
                    asChild
                >
                    <ScrollArea>
                        <div className="relative max-h-50">
                            <div className="p-1">
                                {label ? (
                                    <DropdownMenuLabel>
                                        {label}
                                    </DropdownMenuLabel>
                                ) : null}

                                {items.map((item) => (
                                    <AvatarGroupDropdownRow
                                        key={item.id}
                                        item={item}
                                        avatarClassName={avatarClassName}
                                        rowClassName={rowClassName}
                                    />
                                ))}
                            </div>
                        </div>
                    </ScrollArea>
                </DropdownMenuContent>
            ) : null}
        </DropdownMenu>
    )
}

export function AvatarGroupDropdownPreview({
    items,
    maxVisibleAvatars = DEFAULT_MAX_VISIBLE_AVATARS,
    title,
    avatarClassName,
}: {
    items: Pick<
        AvatarGroupDropdownItem,
        "id" | "name" | "avatarUrl" | "avatarFallback" | "isAnonymous"
    >[]
    maxVisibleAvatars?: number
    title?: string
    avatarClassName?: string
}) {
    const visibleItems = items.slice(0, maxVisibleAvatars)
    const hiddenCount = Math.max(0, items.length - maxVisibleAvatars)

    return (
        <AvatarGroup title={title ?? items.map((item) => item.name).join(", ")}>
            {visibleItems.map((item) => (
                <Avatar key={item.id} size="sm" className={avatarClassName}>
                    <AvatarImage
                        src={item.avatarUrl ?? undefined}
                        alt={item.name}
                    />
                    <AvatarFallback
                        className={cn(
                            "text-xs",
                            item.isAnonymous && "text-[9px]! tracking-tight!"
                        )}
                    >
                        {item.avatarFallback ?? "?"}
                    </AvatarFallback>
                </Avatar>
            ))}
            {hiddenCount > 0 ? (
                <AvatarGroupCount>+{hiddenCount}</AvatarGroupCount>
            ) : null}
        </AvatarGroup>
    )
}
