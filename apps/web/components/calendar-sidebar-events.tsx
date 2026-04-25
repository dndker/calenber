import { useCalendarEventFieldSettings } from "@/hooks/use-calendar-event-field-settings"
import { useCopyCalendarEventLink } from "@/hooks/use-copy-calendar-event-link"
import { useDeleteEvent } from "@/hooks/use-delete-event"
import { useIsMobile } from "@/hooks/use-mobile"
import { getCalendarCategoryLabelClassName } from "@/lib/calendar/category-color"
import {
    formatCalendarEventRecurrenceOrDateLabel,
    formatCalendarEventScheduleLabelFromEvent,
} from "@/lib/calendar/event-date-format"
import { orderCalendarEventFieldIds } from "@/lib/calendar/event-field-settings"
import { getCalendarEventModalPath } from "@/lib/calendar/routes"
import {
    type CalendarEvent,
    type CalendarEventFieldId,
} from "@/store/calendar-store.types"
import { useCalendarStore } from "@/store/useCalendarStore"
import { Badge } from "@workspace/ui/components/badge"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@workspace/ui/components/hover-card"
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarSeparator,
} from "@workspace/ui/components/sidebar"
import {
    CalendarIcon,
    ChevronRightIcon,
    CircleCheckBigIcon,
    MoreHorizontal,
    Repeat2Icon,
    ShareIcon,
    StarOffIcon,
    TagsIcon,
    Trash2Icon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import React, { memo, useMemo, useState } from "react"
import { toast } from "sonner"
import { EventStatusItem } from "./calendar/event-form-status-field"

function normalizeWhitespace(value: string) {
    return value.replace(/\s+/g, " ").trim()
}

function extractPlainText(value: unknown): string {
    if (typeof value === "string") {
        return value
    }

    if (Array.isArray(value)) {
        return value.map(extractPlainText).filter(Boolean).join(" ")
    }

    if (value && typeof value === "object") {
        return Object.entries(value)
            .filter(([key]) => !["id", "type", "props", "styles"].includes(key))
            .map(([, nestedValue]) => extractPlainText(nestedValue))
            .filter(Boolean)
            .join(" ")
    }

    return ""
}

function truncateText(value: string, maxLength: number) {
    if (value.length <= maxLength) {
        return value
    }

    return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

function getEventContentPreview(event: CalendarEvent) {
    const plainText = normalizeWhitespace(extractPlainText(event.content))

    if (!plainText) {
        return false
    }

    return truncateText(plainText, 72)
}

type HoverCardPropertyItem = {
    id: Extract<
        CalendarEventFieldId,
        "schedule" | "recurrence" | "status" | "categories"
    >
    content: React.ReactNode
}

const hoverCardFieldIds: HoverCardPropertyItem["id"][] = [
    "schedule",
    "recurrence",
    "status",
    "categories",
]

export const CalendarSidebarEvents = memo(function CalendarSidebarEvents() {
    const events = useCalendarStore((s) => s.events)
    const favoriteEventMap = useCalendarStore((s) => s.favoriteEventMap)

    const favoriteEvents = useMemo(
        () =>
            [...events]
                .filter((event) => event.id in favoriteEventMap)
                .map((event) => ({
                    ...event,
                    isFavorite: true,
                    favoritedAt:
                        favoriteEventMap[event.id] ?? event.favoritedAt,
                }))
                .sort((a, b) => {
                    const favoriteTimeA = a.favoritedAt ?? 0
                    const favoriteTimeB = b.favoritedAt ?? 0

                    if (favoriteTimeA !== favoriteTimeB) {
                        return favoriteTimeB - favoriteTimeA
                    }

                    if (a.start !== b.start) {
                        return a.start - b.start
                    }

                    return a.createdAt - b.createdAt
                }),
        [events, favoriteEventMap]
    )

    const isFav = favoriteEvents.length > 0

    return (
        isFav && (
            <React.Fragment>
                <SidebarGroup>
                    <Collapsible
                        defaultOpen={true}
                        className="group/collapsible"
                    >
                        <SidebarGroupLabel
                            asChild
                            className="group/label w-full text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        >
                            <CollapsibleTrigger className="flex items-center gap-1">
                                즐겨찾기
                                {favoriteEvents.length > 0 ? (
                                    <Badge variant="outline">
                                        {favoriteEvents.length}개
                                    </Badge>
                                ) : null}
                                <ChevronRightIcon className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                            </CollapsibleTrigger>
                        </SidebarGroupLabel>
                        <CollapsibleContent>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {favoriteEvents.length > 0 ? (
                                        favoriteEvents.map((event) => (
                                            <CalendarSidebarEventItem
                                                key={event.id}
                                                event={event}
                                            />
                                        ))
                                    ) : (
                                        <div className="px-2 py-1 text-sm text-muted-foreground">
                                            즐겨찾기한 일정이 없습니다.
                                        </div>
                                    )}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </CollapsibleContent>
                    </Collapsible>
                </SidebarGroup>
                <SidebarSeparator className="mx-0" />
            </React.Fragment>
        )
    )
})

export const CalendarSidebarEventItem = memo(function CalendarSidebarEvent({
    event,
}: {
    event: CalendarEvent
}) {
    const isMobile = useIsMobile()
    const router = useRouter()
    const activeCalendar = useCalendarStore((s) => s.activeCalendar)
    const toggleEventFavorite = useCalendarStore((s) => s.toggleEventFavorite)
    const { eventFieldSettings } = useCalendarEventFieldSettings()
    const { copyEventLink } = useCopyCalendarEventLink()
    const deleteEvent = useDeleteEvent()
    const [isFavoritePending, setIsFavoritePending] = useState(false)
    const calendarId = activeCalendar?.id ?? "demo"
    const contentPreview = getEventContentPreview(event)
    const recurrencePreview = formatCalendarEventRecurrenceOrDateLabel(event, {
        scheduleVariant: "short",
        omitTime: true,
    })
    const categoryName = event.category?.name?.trim() || null
    const categoryColor = event.category?.options.color || null
    const orderedHoverCardProperties = useMemo(() => {
        const propertyMap = new Map<
            HoverCardPropertyItem["id"],
            HoverCardPropertyItem
        >([
            [
                "schedule",
                {
                    id: "schedule",
                    content: (
                        <div className="flex items-start gap-2.75">
                            <span className="flex w-16 shrink-0 items-center gap-1 font-medium text-muted-foreground uppercase">
                                <CalendarIcon className="size-3.5" />
                                날짜
                            </span>
                            <span className="flex-1 text-foreground">
                                {formatCalendarEventScheduleLabelFromEvent(
                                    event,
                                    {
                                        variant: "long",
                                    }
                                )}
                            </span>
                        </div>
                    ),
                },
            ],
            [
                "recurrence",
                {
                    id: "recurrence",
                    content: event.recurrence ? (
                        <div className="flex gap-2.75">
                            <span className="flex w-16 shrink-0 items-center gap-1 font-medium text-muted-foreground uppercase">
                                <Repeat2Icon className="size-3.5" />
                                반복
                            </span>
                            <span className="flex-1 text-foreground">
                                {recurrencePreview}
                            </span>
                        </div>
                    ) : null,
                },
            ],
            [
                "status",
                {
                    id: "status",
                    content: (
                        <div className="flex gap-2.75">
                            <span className="flex w-16 shrink-0 items-center gap-1 font-medium text-muted-foreground uppercase">
                                <CircleCheckBigIcon className="size-3.5" />
                                상태
                            </span>
                            <span className="flex-1 text-foreground">
                                <EventStatusItem
                                    value={event.status}
                                    size="sm"
                                />
                            </span>
                        </div>
                    ),
                },
            ],
            [
                "categories",
                {
                    id: "categories",
                    content: categoryName ? (
                        <div className="flex gap-2.75">
                            <span className="flex w-16 shrink-0 items-center gap-1 font-medium text-muted-foreground uppercase">
                                <TagsIcon className="size-3.5" />
                                카테고리
                            </span>
                            <span className="flex-1 text-foreground">
                                <span
                                    className={getCalendarCategoryLabelClassName(
                                        categoryColor,
                                        "inline-flex h-5 items-center gap-1.5 rounded-md px-1.5 text-xs"
                                    )}
                                >
                                    {categoryName}
                                </span>
                            </span>
                        </div>
                    ) : null,
                },
            ],
        ])

        return orderCalendarEventFieldIds(eventFieldSettings, hoverCardFieldIds)
            .map((fieldId) => propertyMap.get(fieldId))
            .filter((property): property is HoverCardPropertyItem =>
                Boolean(property?.content)
            )
    }, [
        categoryColor,
        categoryName,
        event,
        eventFieldSettings,
        recurrencePreview,
    ])

    return (
        <SidebarMenuItem>
            <HoverCard openDelay={120} closeDelay={80}>
                <HoverCardTrigger asChild>
                    <SidebarMenuButton
                        className="flex h-auto w-full flex-col items-start gap-0.75 overflow-hidden"
                        onClick={() => {
                            router.push(
                                getCalendarEventModalPath(calendarId, event.id)
                            )
                        }}
                    >
                        <p className="inline-block w-full truncate text-sm">
                            {event.title.trim() || "새 일정"}
                        </p>
                        <div className="flex justify-between text-xs text-muted-foreground">
                            {/* <span>{formatFavoriteEventDate(event)}</span> */}
                            <span>{recurrencePreview}</span>
                        </div>
                    </SidebarMenuButton>
                </HoverCardTrigger>
                <HoverCardContent
                    side="right"
                    align="start"
                    className="w-75 p-2.75"
                >
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-0.5">
                            <p className="truncate text-base font-medium text-foreground">
                                {event.title.trim() || "새 일정"}
                            </p>
                            {contentPreview && (
                                <span className="truncate text-[13px] leading-5 text-muted-foreground">
                                    {contentPreview}
                                </span>
                            )}
                        </div>

                        <div className="grid gap-2.5 rounded-xl bg-muted/40 px-2.5 py-2 **:text-xs">
                            {orderedHoverCardProperties.map((property) => (
                                <React.Fragment key={property.id}>
                                    {property.content}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </HoverCardContent>
            </HoverCard>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <SidebarMenuAction showOnHover className="right-1.5">
                        <MoreHorizontal />
                        <span className="sr-only">More</span>
                    </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    className="w-48"
                    side={isMobile ? "bottom" : "right"}
                    align={isMobile ? "end" : "start"}
                >
                    <DropdownMenuItem
                        disabled={isFavoritePending}
                        onClick={async () => {
                            setIsFavoritePending(true)

                            try {
                                const ok = await toggleEventFavorite(
                                    event.id,
                                    false
                                )

                                if (ok) {
                                    toast.success("즐겨찾기를 해제했습니다.")
                                }
                            } finally {
                                setIsFavoritePending(false)
                            }
                        }}
                    >
                        <StarOffIcon className="text-muted-foreground" />
                        <span>즐겨찾기 해제</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => {
                            void copyEventLink({
                                calendarId,
                                eventId: event.id,
                            })
                        }}
                    >
                        <ShareIcon className="text-muted-foreground" />
                        <span>일정 공유</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        variant="destructive"
                        onClick={() => {
                            void deleteEvent(event.id)
                        }}
                    >
                        <Trash2Icon className="text-muted-foreground" />
                        <span>일정 삭제</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </SidebarMenuItem>
    )
})
