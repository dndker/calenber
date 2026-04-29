import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { useCellMembers } from "@/hooks/use-calendar-cell-member"
import { useCalendarToday } from "@/hooks/use-calendar-today"
import { useOpenEvent } from "@/hooks/use-open-event"
import { normalizeCalendarLayoutOptions } from "@/lib/calendar/layout-options"
import { canCreateCalendarEvents } from "@/lib/calendar/permissions"
import { generateKoreanPublicHolidaySubscriptionEvents } from "@/lib/calendar/subscriptions/providers/korean-public-holidays"
import { toCalendarDay } from "@/lib/date"
import dayjs from "@/lib/dayjs"
import { shallow } from "@/store/createSSRStore"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import { useDroppable } from "@dnd-kit/core"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import clsx from "clsx"
import { PlusIcon } from "lucide-react"
import { memo, useCallback, useMemo, useRef } from "react"
import { DayCellMemberHoverCard } from "./day-cell-member-hover-card"

const KOREA_HOLIDAY_SUBSCRIPTION_SLUG = "subscription.kr.public-holidays"
const holidayDateSetByYear = new Map<number, Set<string>>()

function getHolidayDateSetForYear(year: number) {
    const cached = holidayDateSetByYear.get(year)

    if (cached) {
        return cached
    }

    const rangeStart = dayjs
        .tz(`${year}-01-01`, "Asia/Seoul")
        .startOf("day")
        .valueOf()
    const rangeEnd = dayjs
        .tz(`${year}-12-31`, "Asia/Seoul")
        .endOf("day")
        .valueOf()
    const events = generateKoreanPublicHolidaySubscriptionEvents({
        rangeStart,
        rangeEnd,
        timezone: "Asia/Seoul",
    })
    const nextSet = new Set(
        events.map((event) =>
            dayjs.tz(event.start, "Asia/Seoul").format("YYYY-MM-DD")
        )
    )
    holidayDateSetByYear.set(year, nextSet)
    return nextSet
}

export const DayCell = memo(
    ({ day, isCurrentMonth }: { day: Date; isCurrentMonth: boolean }) => {
        const tCalendar = useDebugTranslations("calendar")
        const createEvent = useOpenEvent()
        const {
            calendarTz,
            showWeekendTextColors,
            showHolidayBackground,
        } = useCalendarStore(
            (s) => {
                const layout = normalizeCalendarLayoutOptions(
                    s.activeCalendar?.layoutOptions
                )
                return {
                    calendarTz: s.calendarTimezone,
                    showWeekendTextColors: layout.showWeekendTextColors,
                    showHolidayBackground: layout.showHolidayBackground,
                }
            },
            shallow
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
        const { dayOfMonth, weekday } = useMemo(() => {
            const inTz = dayjs(day).tz(calendarTz)
            return {
                dayOfMonth: inTz.date(),
                weekday: inTz.day(),
            }
        }, [calendarTz, day])
        const isSunday = weekday === 0
        const isSaturday = weekday === 6
        const { todayDate } = useCalendarToday(calendarTz)

        const {
            activeCalendar,
            activeCalendarMembership,
            subscriptionCatalogs,
            subscriptionState,
            startSelection,
            updateSelection,
            endSelectionStore,
            selection,
            isSelecting,
            isSelected,
            setSelectedDate,
            setViewportMiniDate,
            isHover,
            isSelectingRange,
        } = useCalendarStore((s) => {
            const isHoverState =
                Boolean(s.drag.eventId) &&
                s.drag.mode === "move" &&
                (s.drag.hoveredDateKeys.length > 0
                    ? s.drag.hoveredDateKeys.includes(cellDate)
                    : dayValue >= s.drag.start && dayValue <= s.drag.end)
            const isSelectingRangeState =
                s.selection.isSelecting &&
                Boolean(s.selection.start) &&
                Boolean(s.selection.end) &&
                s.selection.start !== s.selection.end &&
                dayValue >= s.selection.start! &&
                dayValue <= s.selection.end!

            return {
                activeCalendar: s.activeCalendar,
                activeCalendarMembership: s.activeCalendarMembership,
                subscriptionCatalogs: s.subscriptionCatalogs,
                subscriptionState: s.subscriptionState,
                startSelection: s.startSelection,
                updateSelection: s.updateSelection,
                endSelectionStore: s.endSelection,
                selection: s.selection,
                isSelecting: s.selection.isSelecting,
                isSelected: s.selectedDate === dayValue,
                setSelectedDate: s.setSelectedDate,
                setViewportMiniDate: s.setViewportMiniDate,
                isHover: isHoverState,
                isSelectingRange: isSelectingRangeState,
            }
        }, shallow)

        const cellMembers = useCellMembers(cellDate, user?.id)
        const isKoreanHolidayVisible = useMemo(() => {
            const holidayCatalog = subscriptionCatalogs.find(
                (catalog) => catalog.slug === KOREA_HOLIDAY_SUBSCRIPTION_SLUG
            )

            if (!holidayCatalog) {
                return false
            }

            const installed =
                subscriptionState.installedSubscriptionIds.includes(
                    holidayCatalog.id
                )
            const hidden = subscriptionState.hiddenSubscriptionIds.includes(
                holidayCatalog.id
            )

            return installed && !hidden
        }, [
            subscriptionCatalogs,
            subscriptionState.hiddenSubscriptionIds,
            subscriptionState.installedSubscriptionIds,
        ])
        const hasSystemHoliday = useMemo(() => {
            if (!isKoreanHolidayVisible) {
                return false
            }

            const targetYear = dayjs.tz(day, "Asia/Seoul").year()
            const holidaySet = getHolidayDateSetForYear(targetYear)
            return holidaySet.has(cellDate)
        }, [cellDate, day, isKoreanHolidayVisible])

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

            createEvent({ fromCalendarGrid: true, start, end })
        }

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
                    fromCalendarGrid: true,
                    start: selection.start,
                    end: selection.end,
                })
            }
        }

        const isCellMember = useMemo(
            () => cellMembers.length > 0,
            [cellMembers.length]
        )

        const weekendDateTextClass = hasSystemHoliday
            ? "text-red-500/95 dark:text-red-500/80"
            : showWeekendTextColors && isSunday
              ? "text-red-500/95 dark:text-red-500/80"
              : showWeekendTextColors && isSaturday
                ? "text-blue-500/80"
                : ""
        const weekendBackgroundClass =
            showHolidayBackground && (isSunday || isSaturday)
                ? "bg-background/75"
                : ""

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
                        ? [
                              "bg-background text-foreground",
                              weekendBackgroundClass,
                          ]
                        : "bg-background/60 text-muted-foreground/60",
                    isHover && "drag-event bg-blue-50/99.5 dark:bg-blue-50/0.5",
                    isSelectingRange &&
                        "select-event bg-blue-50/99.5 dark:bg-blue-50/0.5"
                )}
            >
                <div className="flex items-center *:inline-flex *:size-8 *:items-center *:justify-center *:rounded-lg">
                    <div className="flex items-center">
                        <>
                            {!isHover && !isSelectingRange && (
                                <Button
                                    size="icon"
                                    variant="outline"
                                    className="hidden size-8 text-muted-foreground group-hover/day:flex"
                                    onClick={handleDoubleClick}
                                >
                                    <PlusIcon />
                                </Button>
                            )}
                            {dayOfMonth === 1 && (
                                <span
                                    className={clsx(
                                        "text-sm text-muted-foreground/80 group-hover/day:hidden",
                                        weekendDateTextClass
                                    )}
                                >
                                    {dayjs.tz(day, calendarTz).format(tCalendar("dateFormatMonth"))}
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
                            className={clsx(
                                "ml-auto",
                                {
                                    "bg-primary text-primary-foreground":
                                        isSelected,
                                    "bg-muted": cellDate === todayDate,
                                    "shadow-none ring-2 ring-ring ring-offset-2 ring-offset-background":
                                        isCellMember,
                                },
                                !isSelected && weekendDateTextClass
                            )}
                        >
                            {dayOfMonth}
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
