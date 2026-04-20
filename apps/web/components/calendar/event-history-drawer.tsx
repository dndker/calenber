"use client"

import { useCalendarEventHistory } from "@/hooks/use-calendar-event-history"
import { type CalendarEventHistoryItem } from "@/lib/calendar/event-history"
import { type CalendarRole } from "@/lib/calendar/permissions"
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
import { Fragment, useMemo } from "react"

const roleLabelMap: Record<CalendarRole, string> = {
    viewer: "뷰어",
    editor: "편집자",
    manager: "매니저",
    owner: "소유자",
}

function getChangePreviewValue(value: unknown) {
    if (value == null) {
        return "-"
    }

    if (typeof value === "string" || typeof value === "number") {
        return String(value)
    }

    if (typeof value === "boolean") {
        return value ? "예" : "아니오"
    }

    return "변경됨"
}

function HistoryRow({ item }: { item: CalendarEventHistoryItem }) {
    return (
        <div className="flex gap-3 p-3">
            <Avatar className="mt-0.5 size-8 shrink-0">
                <AvatarImage
                    src={item.actorAvatarUrl ?? undefined}
                    alt={item.actorName ?? "작업자"}
                />
                <AvatarFallback>
                    {item.actorName?.charAt(0)?.toUpperCase() ?? "?"}
                </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-medium text-primary">
                        {item.actorName ?? item.actorEmail ?? "알 수 없는 멤버"}
                    </div>
                    {item.actorRole === "owner" && (
                        <Badge
                            variant="outline"
                            className="px-1.5 py-0 text-[11px]"
                        >
                            {roleLabelMap[item.actorRole]}
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
                                    ? "추가"
                                    : change.op === "removed"
                                      ? "삭제"
                                      : "변경"}
                                {(change.before !== undefined ||
                                    change.after !== undefined) && (
                                    <span className="ml-1">
                                        {getChangePreviewValue(change.before)}{" "}
                                        {"→"}{" "}
                                        {getChangePreviewValue(change.after)}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                <div className="mt-2 text-xs text-muted-foreground">
                    {dayjs(item.occurredAt).format(
                        "YYYY년 MM월 DD일 HH시 mm분"
                    )}
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
                summary: "일정을 생성했습니다.",
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
            summary: "일정을 생성했습니다.",
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
                        <HistoryIcon className="size-4.5" /> 일정 기록
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
                            아직 기록이 없습니다.
                        </div>
                    )}
                </ScrollArea>
            </DrawerContent>
        </Drawer>
    )
}
