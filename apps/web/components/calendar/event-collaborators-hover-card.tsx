"use client"

import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import {
    AvatarGroupDropdown,
    AvatarGroupDropdownPreview,
    getAvatarGroupBadge,
    getAvatarGroupFallbackLabel,
} from "@/components/calendar/avatar-group-dropdown"
import { useRelativeTime } from "@/hooks/use-relative-time"
import type { CalendarEventHistoryItem } from "@/lib/calendar/event-history"
import { warmCalendarEventHistory } from "@/lib/calendar/event-history"
import type { CalendarRole } from "@/lib/calendar/permissions"
import type { CalendarEvent } from "@/store/calendar-store.types"
import { useMemo } from "react"

type Collaborator = {
    id: string
    name: string
    email: string | null
    avatarUrl: string | null
    role: CalendarRole | null
    lastTouchedAt: number
}

function CollaboratorLastUpdated({ value }: { value: number }) {
    const t = useDebugTranslations("event.collaborators")
    const relativeTime = useRelativeTime(value, { clampFuture: true })

    return (
        <span className="truncate text-xs text-muted-foreground" suppressHydrationWarning>
            {t("updatedAt", { relativeTime })}
        </span>
    )
}

export function EventCollaboratorsHoverCard({
    event,
    history,
}: {
    event: CalendarEvent
    history: CalendarEventHistoryItem[]
}) {
    const t = useDebugTranslations("event.collaborators")
    const tRoles = useDebugTranslations("common.roles")
    const tLabels = useDebugTranslations("common.labels")
    const collaborators = useMemo(() => {
        const map = new Map<string, Collaborator>()

        if (event.authorId) {
            map.set(event.authorId, {
                id: event.authorId,
                name: event.author?.name ?? event.author?.email ?? tLabels("noName"),
                email: event.author?.email ?? null,
                avatarUrl: event.author?.avatarUrl ?? null,
                role: null,
                lastTouchedAt: event.updatedAt,
            })
        }

        for (const item of history) {
            if (!item.actorUserId) {
                continue
            }

            const existing = map.get(item.actorUserId)
            const name =
                item.actorName ?? item.actorEmail ?? tLabels("unknownMember")

            map.set(item.actorUserId, {
                id: item.actorUserId,
                name,
                email: item.actorEmail,
                avatarUrl: item.actorAvatarUrl,
                role: item.actorRole ?? existing?.role ?? null,
                lastTouchedAt: Math.max(
                    existing?.lastTouchedAt ?? 0,
                    item.occurredAt
                ),
            })
        }

        return Array.from(map.values()).sort(
            (a, b) => b.lastTouchedAt - a.lastTouchedAt
        )
    }, [event, history, tLabels])

    if (collaborators.length === 0) {
        return null
    }

    const items = collaborators.map((member) => ({
        id: member.id,
        name: member.name,
        avatarUrl: member.avatarUrl,
        avatarFallback: getAvatarGroupFallbackLabel(member.name),
        badge:
            member.role != null
                ? getAvatarGroupBadge(tRoles(member.role))
                : undefined,
        email: member.email,
        time: <CollaboratorLastUpdated value={member.lastTouchedAt} />,
    }))

    return (
        <AvatarGroupDropdown
            items={items}
            label={t("label", { count: collaborators.length })}
            align="end"
            contentClassName="w-56"
            triggerAsChild
            onTriggerPointerEnter={() => warmCalendarEventHistory(event.id)}
            trigger={
                <button type="button" className="mr-0.5">
                    <AvatarGroupDropdownPreview
                        items={items}
                        maxVisibleAvatars={3}
                        avatarClassName="size-5.75"
                    />
                </button>
            }
        />
    )
}
