import {
    canDeleteCalendarEvent,
    canEditCalendarEvent,
} from "@/lib/calendar/permissions"
import { getCalendarBasePath } from "@/lib/calendar/routes"
import type { CalendarEvent } from "@/store/calendar-store.types"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import { useEventDeleteAction } from "@/hooks/use-event-delete-action"
import { useDraggable } from "@dnd-kit/core"
import { Button } from "@workspace/ui/components/button"
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuGroup,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@workspace/ui/components/context-menu"
import { cn } from "@workspace/ui/lib/utils"
import clsx from "clsx"
import { usePathname, useRouter } from "next/navigation"
import { memo, startTransition, useEffect, useRef } from "react"

export function getEventPosition(startIndex: number, endIndex: number) {
    const span = endIndex - startIndex + 1

    const GAP = 4

    return {
        left: `calc(${(startIndex / 7) * 100}% + ${GAP}px)`,
        width: `calc(${(span / 7) * 100}% - ${GAP * 2}px)`,
    }
}

export const EventItem = memo(
    function EventItem({
        event,
        top,
        startIndex,
        endIndex,
        dragOffsetStart = 0,
        laneCount = 1,
        overlay = false,
    }: {
        event: CalendarEvent
        top: number
        startIndex: number
        endIndex: number
        dragOffsetStart?: number
        laneCount?: number
        overlay?: boolean
    }) {
        const router = useRouter()
        const pathname = usePathname()

        const user = useAuthStore((s) => s.user)
        const activeCalendar = useCalendarStore((s) => s.activeCalendar)
        const activeCalendarMembership = useCalendarStore(
            (s) => s.activeCalendarMembership
        )
        const eventLayout = useCalendarStore((s) => s.eventLayout)
        const setActiveEventId = useCalendarStore((s) => s.setActiveEventId)
        const startDrag = useCalendarStore((s) => s.startDrag)
        const dragIndexRef = useRef(0)
        const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
            id: event.id,
        })

        const pos = getEventPosition(startIndex, endIndex)
        const canEdit =
            activeCalendar?.id === "demo" ||
            canEditCalendarEvent(event, activeCalendarMembership, user?.id)
        const canDelete =
            activeCalendar?.id === "demo" ||
            canDeleteCalendarEvent(event, activeCalendarMembership, user?.id)
        const handleDeleteEvent = useEventDeleteAction({
            eventId: event.id,
        })

        const handleMoveStart = (e: React.PointerEvent) => {
            if (!canEdit) {
                return
            }

            const rect = e.currentTarget.getBoundingClientRect()
            const offsetX = e.clientX - rect.left

            const visibleDays = endIndex - startIndex + 1
            const dayWidth = rect.width / visibleDays

            const localIndex = Math.min(
                visibleDays - 1,
                Math.max(0, Math.floor(offsetX / dayWidth))
            )
            dragIndexRef.current = dragOffsetStart + localIndex

            listeners?.onPointerDown?.(e)
        }

        const handleResizeStart = (e: React.PointerEvent) => {
            if (!canEdit) {
                return
            }
            startDrag(event, "resize-start", event.start)
            listeners?.onPointerDown?.(e)
        }

        const handleResizeEnd = (e: React.PointerEvent) => {
            if (!canEdit) {
                return
            }
            startDrag(event, "resize-end", event.end)
            listeners?.onPointerDown?.(e)
        }

        useEffect(() => {
            if (!isDragging) return

            startDrag(event, "move", dragIndexRef.current)

            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [isDragging])

        const mergedListeners = canEdit
            ? {
                  ...listeners,
                  onPointerDown: handleMoveStart,
              }
            : undefined

        const useSplitLayout =
            !overlay && eventLayout === "split" && laneCount > 0
        const itemTop = useSplitLayout
            ? `calc(${(top / laneCount) * 100}% + 2px)`
            : `${top * 32}px`
        const itemHeight = useSplitLayout
            ? `calc(${100 / laneCount}% - 4px)`
            : "28px"

        return (
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <div
                        ref={setNodeRef}
                        {...mergedListeners}
                        {...attributes}
                        className={clsx(
                            "absolute will-change-transform select-none",
                            {
                                "event-drag-row opacity-50": isDragging,
                                "cursor-grab active:cursor-grabbing":
                                    overlay && canEdit,
                            }
                        )}
                        style={{
                            ...pos,
                            width: overlay ? "100%" : pos?.width,
                            top: itemTop,
                            left: overlay ? "0" : pos?.left,
                            height: overlay ? "100%" : itemHeight,
                            zIndex: isDragging ? 100 : 1,
                            // background: event.color,
                        }}
                    >
                        <div
                            onPointerDown={handleResizeStart}
                            className={cn(
                                "absolute top-0 left-0 z-1 h-full w-1 bg-transparent",
                                canEdit && "cursor-ew-resize"
                            )}
                        />

                        <Button
                            variant="outline"
                            className={cn(
                                "pointer-events-auto h-full w-full justify-start overflow-hidden rounded px-1 transition-none will-change-transform dark:bg-[#151515] dark:hover:bg-[#1c1c1c] [body[data-scroll-locked='1']_&]:pointer-events-none",
                                useSplitLayout
                                    ? "items-start py-1.5 text-left"
                                    : "py-1",
                                eventLayout === "split" &&
                                    "items-center justify-center"
                            )}
                            onClick={() => {
                                setActiveEventId(event.id)
                                startTransition(() => {
                                    router.push(
                                        `${getCalendarBasePath(pathname)}?e=${encodeURIComponent(event.id)}`
                                    )
                                })
                            }}
                        >
                            {event.title === "" ? "새 일정" : event.title}
                        </Button>

                        <div
                            onPointerDown={handleResizeEnd}
                            className={cn(
                                "absolute top-0 right-0 z-100 h-full w-1 bg-transparent",
                                canEdit && "hover:cursor-ew-resize"
                            )}
                        />
                    </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-48">
                    <ContextMenuGroup>
                        <ContextMenuItem
                            variant="destructive"
                            disabled={!canDelete}
                            onSelect={() => {
                                void handleDeleteEvent()
                            }}
                        >
                            일정 삭제
                        </ContextMenuItem>
                    </ContextMenuGroup>
                </ContextMenuContent>
            </ContextMenu>
        )
    },
    (prev, next) => {
        return (
            prev.event.id === next.event.id &&
            prev.event.start === next.event.start &&
            prev.event.end === next.event.end &&
            prev.event.title === next.event.title &&
            prev.event.color === next.event.color &&
            prev.top === next.top &&
            prev.startIndex === next.startIndex &&
            prev.endIndex === next.endIndex &&
            prev.dragOffsetStart === next.dragOffsetStart &&
            prev.laneCount === next.laneCount &&
            prev.overlay === next.overlay
        )
    }
)
