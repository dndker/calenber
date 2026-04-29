"use client"

import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { useCalendarEventHistory } from "@/hooks/use-calendar-event-history"
import { type CalendarEventHistoryItem } from "@/lib/calendar/event-history"
import dayjs from "@/lib/dayjs"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from "@workspace/ui/components/drawer"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { HistoryIcon } from "lucide-react"
import { useLocale } from "next-intl"
import { Fragment, useMemo } from "react"

function getChangePreviewValue(
    value: unknown,
    t: ReturnType<typeof useDebugTranslations>
) {
    if (value == null) {
        return "-"
    }

    if (typeof value === "string" || typeof value === "number") {
        return String(value)
    }

    if (typeof value === "boolean") {
        return value ? t("valueTrue") : t("valueFalse")
    }

    return t("valueChanged")
}

function HistoryRow({ item }: { item: CalendarEventHistoryItem }) {
    const t = useDebugTranslations("event.history")
    const tRoles = useDebugTranslations("common.roles")
    const tLabels = useDebugTranslations("common.labels")
    const locale = useLocale()
    return (
        <div className="flex gap-3 p-3">
            <Avatar className="mt-0.5 size-8 shrink-0">
                <AvatarImage
                    src={item.actorAvatarUrl ?? undefined}
                    alt={item.actorName ?? t("actorFallback")}
                />
                <AvatarFallback>
                    {item.actorName?.charAt(0)?.toUpperCase() ?? "?"}
                </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-medium text-primary">
                        {item.actorName ?? item.actorEmail ?? tLabels("unknownMember")}
                    </div>
                    {item.actorRole === "owner" && (
                        <Badge
                            variant="outline"
                            className="px-1.5 py-0 text-[11px]"
                        >
                            {tRoles(item.actorRole)}
                        </Badge>
                    )}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                    {item.summary}
                </div>
                {item.changes.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1.5">
                        {item.changes.map((change, index) => (
                            <div
                                key={`${item.id}-${change.field}-${index}`}
                                className="rounded-lg bg-muted/50 px-2.5 py-2 text-xs text-muted-foreground"
                            >
                                <span className="font-medium text-foreground">
                                    {change.label}
                                </span>{" "}
                                {change.op === "added"
                                    ? t("changeAdded")
                                    : change.op === "removed"
                                      ? t("changeRemoved")
                                      : t("changeUpdated")}
                                {(change.before !== undefined ||
                                    change.after !== undefined) && (
                                    <span className="ml-1">
                                        {getChangePreviewValue(change.before, t)}{" "}
                                        {"→"}{" "}
                                        {getChangePreviewValue(change.after, t)}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                <div className="mt-2 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat(
                        locale === "ko" ? "ko-KR" : "en-US",
                        {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                        }
                    ).format(dayjs(item.occurredAt).toDate())}
                </div>
            </div>
        </div>
    )
}

export function EventHistoryDrawer({
    eventId,
    open,
    onOpenChange,
    portalContainer,
    preloadedHistory,
}: {
    eventId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    portalContainer?: HTMLElement | null
    preloadedHistory?: CalendarEventHistoryItem[] | null
}) {
    const t = useDebugTranslations("event.history")
    const { history, isLoading } = useCalendarEventHistory(eventId, {
        enabled: open,
        preloaded: preloadedHistory,
    })
    const displayHistory = useMemo(() => {
        if (history.length === 0) {
            return history
        }

        const createdIndex = history.findIndex(
            (item) => item.action === "created"
        )

        if (createdIndex >= 0) {
            const createdItem = history[createdIndex]

            if (!createdItem) {
                return history
            }

            const normalizedCreatedItem: CalendarEventHistoryItem = {
                ...createdItem,
                summary: t("createdSummary"),
                changes: [],
            }

            return [
                ...history.slice(0, createdIndex),
                ...history.slice(createdIndex + 1),
                normalizedCreatedItem,
            ]
        }

        const oldestItem = history[history.length - 1]

        if (!oldestItem) {
            return history
        }

        const fallbackCreatedItem: CalendarEventHistoryItem = {
            ...oldestItem,
            id: `${oldestItem.id}-created-fallback`,
            action: "created",
            summary: t("createdSummary"),
            changes: [],
        }

        return [...history, fallbackCreatedItem]
    }, [history])

    return (
        <Drawer open={open} onOpenChange={onOpenChange} direction="right">
            <DrawerContent
                onOpenAutoFocus={(e) => e.preventDefault()}
                onPointerDownOutside={(e) => e.stopPropagation()}
                container={portalContainer ?? undefined}
                className="w-full max-w-105 rounded-none!"
            >
                <DrawerHeader className="border-b px-4 py-3 text-left">
                    <DrawerTitle className="flex items-center gap-1">
                        <HistoryIcon className="size-4.5" /> {t("title")}
                    </DrawerTitle>
                    <DrawerDescription></DrawerDescription>
                </DrawerHeader>
                <ScrollArea className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
                    {isLoading && displayHistory.length === 0 ? (
                        <>
                            <Skeleton className="h-22 rounded-xl" />
                            <Skeleton className="h-22 rounded-xl" />
                            <Skeleton className="h-22 rounded-xl" />
                        </>
                    ) : displayHistory.length > 0 ? (
                        displayHistory.map((item) => (
                            <Fragment key={item.id}>
                                <HistoryRow item={item} />
                                <Separator />
                            </Fragment>
                        ))
                    ) : (
                        <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                            {t("empty")}
                        </div>
                    )}
                </ScrollArea>
            </DrawerContent>
        </Drawer>
    )
}
