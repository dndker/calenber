import { useCellMembers } from "@/hooks/use-calendar-cell-member"
import { useCalendarToday } from "@/hooks/use-calendar-today"
import { useOpenEvent } from "@/hooks/use-open-event"
import { canCreateCalendarEvents } from "@/lib/calendar/permissions"
import { toCalendarDay } from "@/lib/date"
import dayjs from "@/lib/dayjs"
import type { CalendarWorkspacePresenceMember } from "@/store/calendar-store.types"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import { useDroppable } from "@dnd-kit/core"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import clsx from "clsx"
import { PlusIcon } from "lucide-react"
import { memo, useCallback, useMemo, useRef } from "react"
import { DayCellMemberHoverCard } from "./day-cell-member-hover-card"

export const DayCell = memo(
    ({ day, isCurrentMonth }: { day: Date; isCurrentMonth: boolean }) => {
        const createEvent = useOpenEvent()

        const activeCalendar = useCalendarStore((s) => s.activeCalendar)
        const activeCalendarMembership = useCalendarStore(
            (s) => s.activeCalendarMembership
        )
        const calendarTz = useCalendarStore((s) => s.calendarTimezone)
        const startSelection = useCalendarStore((s) => s.startSelection)
        const updateSelection = useCalendarStore((s) => s.updateSelection)
        const endSelectionStore = useCalendarStore((s) => s.endSelection)
        const selection = useCalendarStore((s) => s.selection)
        const isSelecting = useCalendarStore((s) => s.selection.isSelecting)
        const workspacePresence = useCalendarStore(
            (s): CalendarWorkspacePresenceMember[] => s.workspacePresence
        )
        const user = useAuthStore((s) => s.user)

        const isDraggingRef = useRef(false)
        const cellDate = useMemo(() => {
            return dayjs.tz(day, calendarTz).format("YYYY-MM-DD")
        }, [calendarTz, day])

        const { setNodeRef } = useDroppable({
            id: cellDate,
        })

        const dayValue = useMemo(() => {
            return toCalendarDay(day, calendarTz)
        }, [day, calendarTz])
        const { todayDate } = useCalendarToday(calendarTz)

        const isSelected = useCalendarStore((s) => s.selectedDate === dayValue)
        const setSelectedDate = useCalendarStore((s) => s.setSelectedDate)
        const setViewportMiniDate = useCalendarStore(
            (s) => s.setViewportMiniDate
        )

        const cellMembers = useCellMembers(cellDate, user?.id)

        const handleClick = useCallback(() => {
            if (isDraggingRef.current) {
                isDraggingRef.current = false
                return
            }

            setSelectedDate(day)
            setViewportMiniDate(day)
        }, [day, setSelectedDate, setViewportMiniDate])

        const handleDoubleClick = () => {
            if (
                activeCalendar?.id !== "demo" &&
                !canCreateCalendarEvents(activeCalendarMembership)
            ) {
                return
            }

            const start = dayjs.tz(day, calendarTz).startOf("day").valueOf()
            const end = dayjs.tz(day, calendarTz).endOf("day").valueOf()

            createEvent({ start, end })
        }

        const isHover = useCalendarStore((s) => {
            if (!s.drag.eventId) return false
            if (s.drag.mode !== "move") return false
            return dayValue >= s.drag.start && dayValue <= s.drag.end
        })

        const handlePointerDown = (e: React.PointerEvent) => {
            // 🔥 이벤트 클릭이면 무시
            if ((e.target as HTMLElement).closest(".event-drag-row")) return
            if (
                activeCalendar?.id !== "demo" &&
                !canCreateCalendarEvents(activeCalendarMembership)
            ) {
                return
            }
            isDraggingRef.current = false
            // updateCellCursor()

            startSelection(dayValue)
        }

        const handlePointerEnter = () => {
            // updateCellCursor()

            if (!isSelecting) return
            isDraggingRef.current = true
            updateSelection(dayValue)
        }

        const handlePointerUp = () => {
            if (!isSelecting) return
            endSelectionStore()

            // 🔥 range일 때만 이동
            if (
                selection.start &&
                selection.end &&
                selection.start !== selection.end &&
                (activeCalendar?.id === "demo" ||
                    canCreateCalendarEvents(activeCalendarMembership))
            ) {
                createEvent({
                    start: selection.start,
                    end: selection.end,
                })
            }
        }

        const isSelectingRange = useCalendarStore((s) => {
            if (!s.selection.isSelecting) return false
            if (!s.selection.start || !s.selection.end) return false
            if (s.selection.start === s.selection.end) return false

            return dayValue >= s.selection.start && dayValue <= s.selection.end
        })

        const isCellMember = useMemo(
            () => cellMembers.length > 0,
            [cellMembers.length]
        )

        return (
            <div
                data-date={cellDate}
                ref={setNodeRef}
                onPointerDown={handlePointerDown}
                onPointerEnter={handlePointerEnter}
                onPointerUp={handlePointerUp}
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                className={cn(
                    "group/day relative flex flex-col overflow-hidden p-3 text-sm font-medium select-none",
                    isCurrentMonth
                        ? "bg-background text-foreground"
                        : "bg-background/80 text-muted-foreground/60",
                    isHover && "drag-event bg-blue-50/99.5 dark:bg-blue-50/0.5",
                    isSelectingRange &&
                        "select-event bg-blue-50/99.5 dark:bg-blue-50/0.5"
                )}
            >
                <div className="flex items-center *:inline-flex *:size-8 *:items-center *:justify-center *:rounded-lg">
                    <div className="flex items-center">
                        <>
                            <Button
                                size="icon"
                                variant="outline"
                                className="hidden size-8 text-muted-foreground group-hover/day:flex"
                                onClick={handleDoubleClick}
                            >
                                <PlusIcon />
                            </Button>
                            {day.getDate() === 1 && (
                                <span className="text-sm text-muted-foreground/80 group-hover/day:hidden">
                                    {dayjs.tz(day, calendarTz).format("M월")}
                                </span>
                            )}
                        </>
                    </div>

                    <DayCellMemberHoverCard
                        cellMembers={cellMembers}
                        sideOffset={5.5}
                        alignOffset={-3}
                        align="end"
                    >
                        <span
                            className={clsx("ml-auto", {
                                "bg-primary text-primary-foreground":
                                    isSelected,
                                "bg-muted": cellDate === todayDate,
                                "shadow-none ring-2 ring-ring ring-offset-2 ring-offset-background":
                                    isCellMember,
                            })}
                        >
                            {day.getDate()}
                        </span>
                    </DayCellMemberHoverCard>
                </div>
            </div>
        )
    },
    (prev, next) =>
        prev.day.getTime() === next.day.getTime() &&
        prev.isCurrentMonth === next.isCurrentMonth
)

DayCell.displayName = "DayCell"
