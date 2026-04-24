import { EventFormCategoryChipsField } from "@/components/calendar/event-form-category-field"
import { EventFormStatusCheckListField } from "@/components/calendar/event-form-status-field"
import { useEventMembers } from "@/hooks/use-calendar-event-member"
import { useEventDeleteAction } from "@/hooks/use-event-delete-action"
import { useEventQuickPropertySave } from "@/hooks/use-event-quick-property-save"
import { lockCalendarBodyCursor } from "@/lib/calendar/body-cursor-lock"
import {
    getCalendarCategoryEventClassName,
    getCalendarCategoryEventHoverClassName,
} from "@/lib/calendar/category-color"
import { normalizeNames } from "@/lib/calendar/event-form-names"
import { navigateCalendarModal } from "@/lib/calendar/modal-navigation"
import { getCalendarModalOpenPath } from "@/lib/calendar/modal-route"
import {
    canDeleteCalendarEvent,
    canEditCalendarEvent,
} from "@/lib/calendar/permissions"
import {
    getCalendarEventRenderId,
    getCalendarEventSourceId,
    toCalendarEventSource,
} from "@/lib/calendar/recurrence"
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
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger,
} from "@workspace/ui/components/context-menu"
import { cn } from "@workspace/ui/lib/utils"
import clsx from "clsx"
import {
    CheckIcon,
    CircleCheckBigIcon,
    ListIcon,
    LockIcon,
    StarIcon,
    TagsIcon,
    TrashIcon,
    XIcon,
} from "lucide-react"
import { usePathname } from "next/navigation"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"

/**
 * 리사이즈로 `startIndex`/`endIndex`가 바뀌면 `EventRow`의 key가 달라져 `EventItem`이 언마운트된다.
 * 이때 인스턴스의 `useEffect` 정리로 window 리스너가 제거되면 포인터는 눌린 채인데 드래그만 끊긴다.
 * 홀드 중에는 동일 세션으로 리스너·포인터 캡처를 유지하기 위해 모듈 스코프에 둔다.
 */
let calendarEventResizeSessionCleanup: (() => void) | null = null

function disposeCalendarEventResizeSession() {
    calendarEventResizeSessionCleanup?.()
    calendarEventResizeSessionCleanup = null
}

const RESIZE_HANDLE_GLOW = "bg-muted-foreground/10 dark:bg-muted-foreground/30"

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
    // 주 칸 인덱스는 항상 정수. 부동소수/미세 오차로 calc(%) 좌·너비가 따로 반올림되며 끝이 흔들릴 수 있음
    const safeStart = Math.max(0, Math.min(6, Math.floor(startIndex)))
    const safeEnd = Math.max(0, Math.min(6, Math.floor(endIndex)))
    const s = Math.min(safeStart, safeEnd)
    const e = Math.max(safeStart, safeEnd)
    const span = e - s + 1

    const GAP = 4
    const COLUMN_GAP = 1
    const TOTAL_COLUMN_GAPS = COLUMN_GAP * 6
    const leftGap = continuesFromPrevWeek ? 0 : GAP
    const rightGap = continuesToNextWeek ? 0 : GAP
    const dayWidth = `(100% - ${TOTAL_COLUMN_GAPS}px) / 7`
    const left = s
        ? `calc(${s} * (${dayWidth} + ${COLUMN_GAP}px) + ${leftGap}px)`
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
        layoutWeekStart,
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
        /** 월 그리드 한 주의 시작일(`EventRow`의 `weekStart`). 리사이즈 레인 고정·핸들 활성 표시에 사용 */
        layoutWeekStart?: number
    }) {
        const pathname = usePathname()
        const sourceEventId = getCalendarEventSourceId(event)

        const user = useAuthStore((s) => s.user)
        const activeCalendar = useCalendarStore((s) => s.activeCalendar)
        const activeCalendarMembership = useCalendarStore(
            (s) => s.activeCalendarMembership
        )
        const eventLayout = useCalendarStore((s) => s.eventLayout)
        const calendarTz = useCalendarStore((s) => s.calendarTimezone)
        const setActiveEventId = useCalendarStore((s) => s.setActiveEventId)
        const setViewEvent = useCalendarStore((s) => s.setViewEvent)
        const isSeriesHover = useCalendarStore(
            (s) => s.hoveredSeriesEventId === sourceEventId
        )
        const setHoveredSeriesEventId = useCalendarStore(
            (s) => s.setHoveredSeriesEventId
        )
        const startDrag = useCalendarStore((s) => s.startDrag)
        const moveDrag = useCalendarStore((s) => s.moveDrag)
        const endDrag = useCalendarStore((s) => s.endDrag)
        const sourceEvent = useCalendarStore(
            (s) =>
                s.events.find((candidate) => candidate.id === sourceEventId) ??
                null
        )
        const dragIndexRef = useRef(0)
        const resizeFrameRef = useRef<number | null>(null)
        const lastResizeDateRef = useRef<string | null>(null)
        const suppressClickRef = useRef(false)
        const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
            id: getCalendarEventRenderId(event),
            disabled: !interactive || overlay,
        })
        const resolvedSourceEvent = sourceEvent ?? toCalendarEventSource(event)

        const thisRenderId = getCalendarEventRenderId(event)
        const isResizeTarget = useCalendarStore((s) => {
            const mode = s.drag.mode
            if (mode !== "resize-start" && mode !== "resize-end") {
                return false
            }
            return s.drag.renderId === thisRenderId
        }, Object.is)
        const isResizingThis = !inline && !overlay && isResizeTarget

        const activeResizeEdge = useCalendarStore((s) => {
            const mode = s.drag.mode
            if (mode !== "resize-start" && mode !== "resize-end") {
                return null
            }
            if (s.drag.renderId !== thisRenderId) {
                return null
            }
            return s.drag.resizeActiveEdge
        }, Object.is)

        const pos = getEventPosition(
            startIndex,
            endIndex,
            continuesFromPrevWeek,
            continuesToNextWeek
        )
        const canEdit =
            activeCalendar?.id === "demo" ||
            canEditCalendarEvent(
                resolvedSourceEvent,
                activeCalendarMembership,
                user?.id
            )
        const canDelete =
            activeCalendar?.id === "demo" ||
            canDeleteCalendarEvent(
                resolvedSourceEvent,
                activeCalendarMembership,
                user?.id
            )
        const handleDeleteEvent = useEventDeleteAction({
            eventId: sourceEventId,
        })

        /**
         * 루트 컨텍스트 메뉴 전체 표시 모드.
         * `main`: 즐겨찾기·속성 편집(2depth 서브에 상태/카테고리)·삭제
         * `status` | `category`: 1depth 전체가 해당 설정 폼만 (노션식 전환)
         */
        type EventCtxRootView = "main" | "status" | "category"
        const [ctxRootView, setCtxRootView] = useState<EventCtxRootView>("main")

        /** 닫을 때 `main`으로 바꾸면 닫힘 애니메이션 도중 한 프레임 메인 메뉴가 보인다. 열릴 때만 초기화한다. */
        const handleRootCtxOpenChange = useCallback((open: boolean) => {
            if (open) {
                setCtxRootView("main")
            }
        }, [])

        const {
            saveStatus,
            saveCategoryNames,
            getDraftCategoryColor,
            eventCategories,
        } = useEventQuickPropertySave({
            sourceEventId,
            disabled: !canEdit,
        })
        const propertyCategoryNames = useMemo(
            () =>
                normalizeNames(
                    resolvedSourceEvent.categories.map(
                        (category) => category.name
                    )
                ),
            [resolvedSourceEvent.categories]
        )
        const [categoryDraft, setCategoryDraft] = useState<string[]>(
            propertyCategoryNames
        )

        useEffect(() => {
            if (ctxRootView === "category") {
                setCategoryDraft(propertyCategoryNames)
            }
        }, [ctxRootView, propertyCategoryNames])

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

            disposeCalendarEventResizeSession()
            suppressClickRef.current = true

            const pointerId = e.pointerId
            const handleElement = e.currentTarget as HTMLDivElement
            const body =
                typeof document !== "undefined" ? document.body : handleElement
            let pointerCaptureEl: HTMLElement = body
            const releaseResizeCursor = lockCalendarBodyCursor(
                `resize-${pointerId}`,
                "ew-resize"
            )
            const updateFromPointer = (clientX: number, clientY: number) => {
                const hitTargets = document.elementsFromPoint(clientX, clientY)
                const target = hitTargets.find((node) =>
                    (node as HTMLElement).closest?.("[data-date]")
                ) as HTMLElement | undefined
                const cell = target?.closest(
                    "[data-date]"
                ) as HTMLElement | null
                const date = cell?.dataset.date
                if (!date) {
                    return
                }

                if (lastResizeDateRef.current === date) {
                    return
                }

                lastResizeDateRef.current = date
                moveDrag(dayjs.tz(date, calendarTz).startOf("day").valueOf())
            }

            startDrag(
                event,
                mode,
                mode === "resize-start" ? event.start : event.end,
                {
                    segmentOffset: dragOffsetStart,
                    ...(layoutWeekStart !== undefined
                        ? {
                              resizePinnedLane: top,
                              resizeLayoutWeekStart: layoutWeekStart,
                          }
                        : {}),
                }
            )
            updateFromPointer(e.clientX, e.clientY)

            const handlePointerMove = (event: PointerEvent) => {
                if (resizeFrameRef.current !== null) {
                    return
                }

                resizeFrameRef.current = requestAnimationFrame(() => {
                    resizeFrameRef.current = null
                    updateFromPointer(event.clientX, event.clientY)
                })
            }

            const handlePointerUp = (event: PointerEvent) => {
                if (event.pointerId !== pointerId) {
                    return
                }

                disposeCalendarEventResizeSession()
                endDrag()
                queueMicrotask(() => {
                    suppressClickRef.current = false
                })
            }

            const handleWindowBlur = () => {
                disposeCalendarEventResizeSession()
                endDrag()
                suppressClickRef.current = false
            }

            const cleanup = () => {
                if (resizeFrameRef.current !== null) {
                    cancelAnimationFrame(resizeFrameRef.current)
                    resizeFrameRef.current = null
                }
                lastResizeDateRef.current = null
                window.removeEventListener("pointermove", handlePointerMove)
                window.removeEventListener("pointerup", handlePointerUp)
                window.removeEventListener("pointercancel", handlePointerUp)
                window.removeEventListener("blur", handleWindowBlur)
                if (pointerCaptureEl.hasPointerCapture(pointerId)) {
                    pointerCaptureEl.releasePointerCapture(pointerId)
                }
                releaseResizeCursor()
                calendarEventResizeSessionCleanup = null
            }

            try {
                body.setPointerCapture(pointerId)
                pointerCaptureEl = body
            } catch {
                // 일부 환경에서 body 캡처가 거부되면 핸들 요소로 폴백(언마운트 시 캡처가 끊길 수 있음)
                handleElement.setPointerCapture(pointerId)
                pointerCaptureEl = handleElement
            }
            window.addEventListener("pointermove", handlePointerMove)
            window.addEventListener("pointerup", handlePointerUp)
            window.addEventListener("pointercancel", handlePointerUp)
            window.addEventListener("blur", handleWindowBlur)
            calendarEventResizeSessionCleanup = cleanup
        }

        useEffect(() => {
            onDragStateChange?.(isDragging)
        }, [isDragging, onDragStateChange])

        useEffect(() => {
            if (!isDragging) return
            if (!canEdit) return
            if (overlay) return

            const releaseMoveCursor = lockCalendarBodyCursor(
                `move-${thisRenderId}`,
                "grabbing"
            )

            startDrag(event, "move", dragIndexRef.current, {
                segmentOffset: dragOffsetStart,
            })

            return () => {
                releaseMoveCursor()
            }

            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [isDragging, canEdit, overlay, thisRenderId])

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

        const eventMembers = useEventMembers(sourceEventId, user?.id)
        const isCompleted = event.status === "completed"
        const isCancelled = event.status === "cancelled"
        const primaryCategoryColor =
            event.categories[0]?.options.color ?? event.category?.options.color
        const resolvedSeriesHoverClassName =
            isSeriesHover && !isDragging
                ? primaryCategoryColor
                    ? getCalendarCategoryEventHoverClassName(
                          primaryCategoryColor
                      )
                    : "bg-muted text-foreground dark:bg-input/50"
                : undefined
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
                  zIndex: isDragging ? 10 : isResizingThis ? 16 : 1,
              }

        return (
            <ContextMenu onOpenChange={handleRootCtxOpenChange}>
                <ContextMenuTrigger asChild>
                    <div
                        {...mergedListeners}
                        {...attributes}
                        className={clsx(
                            "absolute will-change-transform select-none",
                            {
                                "event-drag-row opacity-50":
                                    isDragging && !event.isLocked,
                                "pointer-events-none": isDragging && !overlay,
                                "cursor-grab! active:cursor-grabbing!":
                                    overlay && canEdit,
                            }
                        )}
                        style={wrapperStyle}
                    >
                        {!inline && !continuesFromPrevWeek && (
                            <div
                                onPointerDown={handleResizeStart}
                                className={cn(
                                    "pointer-events-auto absolute top-0 left-0 z-10 h-full w-1 bg-transparent hover:bg-border/65 dark:hover:bg-border",
                                    !interactive && "pointer-events-none",
                                    "rounded-s-md",
                                    canEdit && "cursor-ew-resize",
                                    activeResizeEdge === "start" &&
                                        RESIZE_HANDLE_GLOW
                                )}
                                style={{ touchAction: "none" }}
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
                                // primaryCategoryColor && "pl-2.25",
                                primaryCategoryColor &&
                                    getCalendarCategoryEventClassName(
                                        primaryCategoryColor
                                    ),
                                resolvedSeriesHoverClassName,
                                isResizingThis && "bg-muted",
                                isResizingThis &&
                                    getCalendarCategoryEventHoverClassName(
                                        primaryCategoryColor
                                    )
                                // eventMembers.length > 0 &&
                                //     "after:absolute after:top-1/2 after:left-0.5 after:inline-block after:h-[calc(100%-6px)] after:w-0.75 after:-translate-y-1/2 after:rounded-full after:bg-primary/80"
                            )}
                            onPointerEnter={() => {
                                if (overlay || isDragging) {
                                    return
                                }

                                setHoveredSeriesEventId(sourceEventId)
                            }}
                            onPointerLeave={() => {
                                if (overlay) {
                                    return
                                }

                                setHoveredSeriesEventId(null)
                            }}
                            onClick={() => {
                                if (!interactive || suppressClickRef.current) {
                                    return
                                }
                                onOpen?.()
                                setActiveEventId(sourceEventId)
                                setViewEvent(event)
                                navigateCalendarModal(
                                    getCalendarModalOpenPath({
                                        pathname,
                                        eventId: sourceEventId,
                                        occurrenceStart:
                                            event.recurrenceInstance
                                                ?.occurrenceStart,
                                    })
                                )
                            }}
                        >
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
                        {!inline && !continuesToNextWeek && (
                            <div
                                onPointerDown={handleResizeEnd}
                                className={cn(
                                    "pointer-events-auto absolute top-0 right-0 z-10 h-full w-1 bg-transparent hover:bg-border",
                                    !interactive && "pointer-events-none",
                                    "rounded-e-md",
                                    canEdit && "cursor-ew-resize",
                                    activeResizeEdge === "end" &&
                                        RESIZE_HANDLE_GLOW
                                )}
                                style={{ touchAction: "none" }}
                            />
                        )}
                    </div>
                </ContextMenuTrigger>
                <ContextMenuContent
                    className={cn(
                        ctxRootView === "main"
                            ? "w-45"
                            : "w-45 overflow-visible p-0",
                        "duration-0 data-[state=closed]:animate-none data-[state=open]:animate-none"
                    )}
                >
                    {ctxRootView === "main" ? (
                        <>
                            <ContextMenuGroup>
                                <ContextMenuItem disabled={!canDelete}>
                                    <StarIcon />
                                    즐겨찾기
                                </ContextMenuItem>
                                <ContextMenuSub>
                                    <ContextMenuSubTrigger disabled={!canEdit}>
                                        <ListIcon />
                                        속성 편집
                                    </ContextMenuSubTrigger>
                                    <ContextMenuSubContent
                                        className="p-0 duration-0 data-[state=closed]:animate-none data-[state=open]:animate-none"
                                        collisionPadding={12}
                                    >
                                        <ContextMenuGroup className="p-1">
                                            <ContextMenuItem
                                                disabled={!canEdit}
                                                onSelect={(event) => {
                                                    event.preventDefault()
                                                    setCtxRootView("status")
                                                }}
                                            >
                                                <CircleCheckBigIcon />
                                                상태
                                            </ContextMenuItem>
                                            <ContextMenuItem
                                                disabled={!canEdit}
                                                onSelect={(event) => {
                                                    event.preventDefault()
                                                    setCtxRootView("category")
                                                }}
                                            >
                                                <TagsIcon />
                                                카테고리
                                            </ContextMenuItem>
                                        </ContextMenuGroup>
                                    </ContextMenuSubContent>
                                </ContextMenuSub>
                            </ContextMenuGroup>
                            <ContextMenuSeparator />
                            <ContextMenuGroup>
                                <ContextMenuItem
                                    variant="destructive"
                                    disabled={!canDelete}
                                    onSelect={() => {
                                        void handleDeleteEvent()
                                    }}
                                >
                                    <TrashIcon />
                                    일정 삭제
                                </ContextMenuItem>
                            </ContextMenuGroup>
                        </>
                    ) : null}

                    {ctxRootView === "status" ? (
                        <div className="flex flex-col">
                            <div className="overflow-visible">
                                <EventFormStatusCheckListField
                                    value={resolvedSourceEvent.status}
                                    onSelect={(next) => {
                                        saveStatus(next)
                                    }}
                                    disabled={!canEdit}
                                />
                            </div>
                        </div>
                    ) : null}

                    {ctxRootView === "category" ? (
                        <ContextMenuGroup className="p-1">
                            <EventFormCategoryChipsField
                                value={categoryDraft}
                                onChange={(next) => {
                                    setCategoryDraft(next)
                                    void saveCategoryNames(next)
                                }}
                                eventCategories={eventCategories}
                                getDraftCategoryColor={getDraftCategoryColor}
                                listVariant="inline"
                                disabled={!canEdit}
                            />
                        </ContextMenuGroup>
                    ) : null}
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
            prev.event.recurrenceInstance?.key ===
                next.event.recurrenceInstance?.key &&
            prev.event.recurrenceInstance?.sourceStart ===
                next.event.recurrenceInstance?.sourceStart &&
            prev.event.recurrenceInstance?.sourceEnd ===
                next.event.recurrenceInstance?.sourceEnd &&
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
            prev.onOpen === next.onOpen &&
            prev.layoutWeekStart === next.layoutWeekStart
        )
    }
)
