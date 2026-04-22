import { useEventMembers } from "@/hooks/use-calendar-event-member"
import { useEventDeleteAction } from "@/hooks/use-event-delete-action"
import { getCalendarCategoryDotClassName } from "@/lib/calendar/category-color"
import { navigateCalendarModal } from "@/lib/calendar/modal-navigation"
import { getCalendarModalOpenPath } from "@/lib/calendar/modal-route"
import {
    canDeleteCalendarEvent,
    canEditCalendarEvent,
} from "@/lib/calendar/permissions"
import dayjs from "@/lib/dayjs"
import type { CalendarEvent } from "@/store/calendar-store.types"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
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
import { CheckIcon, LockIcon, XIcon } from "lucide-react"
import { usePathname } from "next/navigation"
import { memo, useEffect, useRef } from "react"

function areStringArraysEqual(a: string[], b: string[]) {
    if (a === b) {
        return true
    }

    if (a.length !== b.length) {
        return false
    }

    for (let index = 0; index < a.length; index += 1) {
        if (a[index] !== b[index]) {
            return false
        }
    }

    return true
}

export function getEventPosition(
    startIndex: number,
    endIndex: number,
    continuesFromPrevWeek = false,
    continuesToNextWeek = false
) {
    const span = endIndex - startIndex + 1

    const GAP = 4
    const COLUMN_GAP = 1
    const TOTAL_COLUMN_GAPS = COLUMN_GAP * 6
    const leftGap = continuesFromPrevWeek ? 0 : GAP
    const rightGap = continuesToNextWeek ? 0 : GAP
    const dayWidth = `(100% - ${TOTAL_COLUMN_GAPS}px) / 7`
    const left = startIndex
        ? `calc(${startIndex} * (${dayWidth} + ${COLUMN_GAP}px) + ${leftGap}px)`
        : `${leftGap}px`
    const width = `calc(${span} * ${dayWidth} + ${(span - 1) * COLUMN_GAP}px - ${leftGap + rightGap}px)`

    return {
        left,
        width,
    }
}

export const EventItem = memo(
    function EventItem({
        event,
        top,
        startIndex,
        endIndex,
        continuesFromPrevWeek = false,
        continuesToNextWeek = false,
        dragOffsetStart = 0,
        laneCount = 1,
        displayLaneCount,
        overlay = false,
        inline = false,
        interactive = true,
        onDragStateChange,
        onOpen,
    }: {
        event: CalendarEvent
        top: number
        startIndex: number
        endIndex: number
        continuesFromPrevWeek?: boolean
        continuesToNextWeek?: boolean
        dragOffsetStart?: number
        laneCount?: number
        displayLaneCount?: number
        overlay?: boolean
        inline?: boolean
        interactive?: boolean
        onDragStateChange?: (isDragging: boolean) => void
        onOpen?: () => void
    }) {
        const pathname = usePathname()

        const user = useAuthStore((s) => s.user)
        const activeCalendar = useCalendarStore((s) => s.activeCalendar)
        const activeCalendarMembership = useCalendarStore(
            (s) => s.activeCalendarMembership
        )
        const eventLayout = useCalendarStore((s) => s.eventLayout)
        const calendarTz = useCalendarStore((s) => s.calendarTimezone)
        const setActiveEventId = useCalendarStore((s) => s.setActiveEventId)
        const setViewEvent = useCalendarStore((s) => s.setViewEvent)
        const startDrag = useCalendarStore((s) => s.startDrag)
        const moveDrag = useCalendarStore((s) => s.moveDrag)
        const endDrag = useCalendarStore((s) => s.endDrag)
        const dragIndexRef = useRef(0)
        const resizeCleanupRef = useRef<(() => void) | null>(null)
        const suppressClickRef = useRef(false)
        const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
            id: event.id,
            disabled: !interactive,
        })

        const pos = getEventPosition(
            startIndex,
            endIndex,
            continuesFromPrevWeek,
            continuesToNextWeek
        )
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
            beginResize(e, "resize-start")
        }

        const handleResizeEnd = (e: React.PointerEvent) => {
            if (!canEdit) {
                return
            }
            beginResize(e, "resize-end")
        }

        const beginResize = (
            e: React.PointerEvent,
            mode: "resize-start" | "resize-end"
        ) => {
            e.preventDefault()
            e.stopPropagation()

            resizeCleanupRef.current?.()
            suppressClickRef.current = true

            const pointerId = e.pointerId
            const handleElement = e.currentTarget as HTMLDivElement
            const updateFromPointer = (clientX: number, clientY: number) => {
                const target = document
                    .elementFromPoint(clientX, clientY)
                    ?.closest("[data-date]") as HTMLElement | null

                const date = target?.dataset.date
                if (!date) {
                    return
                }

                moveDrag(dayjs.tz(date, calendarTz).startOf("day").valueOf())
            }

            startDrag(
                event,
                mode,
                mode === "resize-start" ? event.start : event.end
            )
            updateFromPointer(e.clientX, e.clientY)

            const handlePointerMove = (event: PointerEvent) => {
                updateFromPointer(event.clientX, event.clientY)
            }

            const handlePointerUp = (event: PointerEvent) => {
                if (event.pointerId !== pointerId) {
                    return
                }

                resizeCleanupRef.current?.()
                endDrag()
                window.setTimeout(() => {
                    suppressClickRef.current = false
                }, 0)
            }

            const handleWindowBlur = () => {
                resizeCleanupRef.current?.()
                endDrag()
                suppressClickRef.current = false
            }

            const cleanup = () => {
                window.removeEventListener("pointermove", handlePointerMove)
                window.removeEventListener("pointerup", handlePointerUp)
                window.removeEventListener("pointercancel", handlePointerUp)
                window.removeEventListener("blur", handleWindowBlur)
                if (handleElement.hasPointerCapture(pointerId)) {
                    handleElement.releasePointerCapture(pointerId)
                }
                resizeCleanupRef.current = null
            }

            handleElement.setPointerCapture(pointerId)
            window.addEventListener("pointermove", handlePointerMove)
            window.addEventListener("pointerup", handlePointerUp)
            window.addEventListener("pointercancel", handlePointerUp)
            window.addEventListener("blur", handleWindowBlur)
            resizeCleanupRef.current = cleanup
        }

        useEffect(() => {
            onDragStateChange?.(isDragging)
        }, [isDragging, onDragStateChange])

        useEffect(() => {
            return () => {
                resizeCleanupRef.current?.()
            }
        }, [])

        useEffect(() => {
            if (!isDragging) return
            if (!canEdit) return

            startDrag(event, "move", dragIndexRef.current)

            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [isDragging])

        const mergedListeners =
            interactive && canEdit
                ? {
                      ...listeners,
                      onPointerDown: handleMoveStart,
                  }
                : undefined

        const resolvedDisplayLaneCount = displayLaneCount ?? laneCount
        const useSplitLayout =
            !overlay && eventLayout === "split" && resolvedDisplayLaneCount > 0
        const itemTop = useSplitLayout
            ? `calc(${(top / resolvedDisplayLaneCount) * 100}% + 2px)`
            : `${top * 32}px`
        const itemHeight = useSplitLayout
            ? `calc(${100 / resolvedDisplayLaneCount}% - 4px)`
            : "30px"

        const eventMembers = useEventMembers(event.id, user?.id)
        const isCompleted = event.status === "completed"
        const isCancelled = event.status === "cancelled"
        const primaryCategoryColor =
            event.categories[0]?.options.color ?? event.category?.options.color
        const eventRadiusClass = cn(
            continuesFromPrevWeek
                ? "rounded-l-none border-l-0"
                : "rounded-l-md",
            continuesToNextWeek ? "rounded-r-none border-r-0" : "rounded-r-md"
        )

        const wrapperStyle = inline
            ? {
                  position: "relative" as const,
                  width: "100%",
                  height: "30px",
                  zIndex: isDragging ? 10 : 1,
              }
            : {
                  ...pos,
                  width: overlay ? "100%" : pos?.width,
                  top: itemTop,
                  left: overlay ? "0" : pos?.left,
                  height: overlay ? "100%" : itemHeight,
                  zIndex: isDragging ? 10 : 1,
              }

        return (
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <div
                        {...mergedListeners}
                        {...attributes}
                        className={clsx(
                            "absolute will-change-transform select-none",
                            {
                                "event-drag-row opacity-50":
                                    isDragging && !event.isLocked,
                                "cursor-grab! active:cursor-grabbing!":
                                    overlay && canEdit,
                            }
                        )}
                        style={wrapperStyle}
                    >
                        {!inline && (
                            <div
                                onPointerDown={handleResizeStart}
                                className={cn(
                                    "pointer-events-auto absolute top-0 left-0 z-10 h-full w-1 bg-transparent hover:bg-border/65 dark:hover:bg-border",
                                    !interactive && "pointer-events-none",
                                    !continuesFromPrevWeek && "rounded-s-md",
                                    canEdit && "cursor-ew-resize"
                                )}
                            />
                        )}
                        <Button
                            ref={!canEdit ? null : setNodeRef}
                            variant="outline"
                            className={cn(
                                "pointer-events-auto relative h-full w-full items-center justify-start gap-0.75 overflow-hidden border px-1 pl-1.75 text-left transition-none will-change-transform dark:bg-[#151515] dark:hover:bg-[#1c1c1c] [body[data-scroll-locked='1']_&]:pointer-events-none",
                                !interactive && "pointer-events-none",
                                useSplitLayout
                                    ? "items-start py-1.5 text-left"
                                    : "py-1",
                                inline &&
                                    canEdit &&
                                    "cursor-grab active:cursor-grabbing",
                                eventLayout === "split" &&
                                    "items-center justify-center text-center",
                                (isCompleted || isCancelled) &&
                                    "text-muted-foreground line-through",
                                eventMembers.length > 0 && "shadow-lg/7",
                                eventRadiusClass,
                                primaryCategoryColor && "pl-2.25"
                                // eventMembers.length > 0 &&
                                //     "after:absolute after:top-1/2 after:left-0.5 after:inline-block after:h-[calc(100%-6px)] after:w-0.75 after:-translate-y-1/2 after:rounded-full after:bg-primary/80"
                            )}
                            onClick={() => {
                                if (!interactive || suppressClickRef.current) {
                                    return
                                }
                                onOpen?.()
                                setActiveEventId(event.id)
                                setViewEvent(event)
                                navigateCalendarModal(
                                    getCalendarModalOpenPath({
                                        pathname,
                                        eventId: event.id,
                                    })
                                )
                            }}
                        >
                            {primaryCategoryColor ? (
                                <span
                                    className={cn(
                                        getCalendarCategoryDotClassName(
                                            primaryCategoryColor,
                                            "absolute top-1/2 left-0.75 z-10 inline-block h-[calc(100%-9px)] w-0.75 -translate-y-1/2 rounded-full"
                                        )
                                    )}
                                />
                            ) : null}
                            {event.isLocked && !isCompleted && !isCancelled && (
                                <LockIcon className="ml-0.5 size-3.5 shrink-0 text-muted-foreground" />
                            )}
                            {isCompleted && (
                                <CheckIcon className="ml-0.5 size-3.5 shrink-0 text-muted-foreground" />
                            )}
                            {isCancelled && (
                                <XIcon className="ml-0.5 size-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <span className="flex-initial truncate overflow-hidden">
                                {event.title === "" ? "새 일정" : event.title}
                            </span>
                        </Button>
                        {!inline && (
                            <div
                                onPointerDown={handleResizeEnd}
                                className={cn(
                                    "pointer-events-auto absolute top-0 right-0 z-10 h-full w-1 bg-transparent hover:bg-border",
                                    !interactive && "pointer-events-none",
                                    !continuesToNextWeek && "rounded-e-md",
                                    canEdit && "hover:cursor-ew-resize"
                                )}
                            />
                        )}
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
            prev.event.categories[0]?.options.color ===
                next.event.categories[0]?.options.color &&
            prev.event.category?.options.color ===
                next.event.category?.options.color &&
            areStringArraysEqual(
                prev.event.categoryIds,
                next.event.categoryIds
            ) &&
            prev.event.status === next.event.status &&
            prev.top === next.top &&
            prev.startIndex === next.startIndex &&
            prev.endIndex === next.endIndex &&
            prev.continuesFromPrevWeek === next.continuesFromPrevWeek &&
            prev.continuesToNextWeek === next.continuesToNextWeek &&
            prev.dragOffsetStart === next.dragOffsetStart &&
            prev.laneCount === next.laneCount &&
            prev.displayLaneCount === next.displayLaneCount &&
            prev.overlay === next.overlay &&
            prev.inline === next.inline &&
            prev.interactive === next.interactive &&
            prev.onDragStateChange === next.onDragStateChange &&
            prev.onOpen === next.onOpen
        )
    }
)
