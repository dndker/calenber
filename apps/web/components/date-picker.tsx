import { useCalendarToday } from "@/hooks/use-calendar-today"
import { useOpenEvent } from "@/hooks/use-open-event"
import { createCalendarMembership } from "@/lib/calendar/mutations"
import { canCreateCalendarEvents } from "@/lib/calendar/permissions"
import dayjs from "@/lib/dayjs"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { Button } from "@workspace/ui/components/button"
import { Calendar, CalendarPickerMode } from "@workspace/ui/components/calendar"
import {
    SidebarGroup,
    SidebarGroupContent,
} from "@workspace/ui/components/sidebar"
import { Spinner } from "@workspace/ui/components/spinner"
import { CalendarCheck2Icon, CalendarPlusIcon } from "lucide-react"
import { memo, useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

export const DatePicker = memo(function DatePicker() {
    const createEvent = useOpenEvent()

    const user = useAuthStore((s) => s.user)
    const calendarTimezone = useCalendarStore((s) => s.calendarTimezone)
    const activeCalendar = useCalendarStore((s) => s.activeCalendar)
    const activeCalendarMembership = useCalendarStore(
        (s) => s.activeCalendarMembership
    )
    const applyActiveCalendarMembership = useCalendarStore(
        (s) => s.applyActiveCalendarMembership
    )
    const { today } = useCalendarToday(calendarTimezone)
    const selectedDate = useCalendarStore((s) => s.selectedDate)
    const viewportMini = useCalendarStore((s) => s.viewportMini)
    const setSelectedDate = useCalendarStore((s) => s.setSelectedDate)
    const setViewportDate = useCalendarStore((s) => s.setViewportDate)
    const setViewportMiniDate = useCalendarStore((s) => s.setViewportMiniDate)
    const [isJoiningCalendar, setIsJoiningCalendar] = useState(false)

    const isToday = useMemo(() => {
        return (
            today.isSame(selectedDate, "day") &&
            today.isSame(viewportMini, "month")
        )
    }, [today, selectedDate, viewportMini])
    const month = useMemo(
        () =>
            dayjs
                .tz(viewportMini, calendarTimezone)
                .startOf("month")
                .add(12, "hour")
                .toDate(),
        [viewportMini, calendarTimezone]
    )

    const selected = useMemo(
        () => dayjs.tz(selectedDate, calendarTimezone).add(12, "hour").toDate(),
        [selectedDate, calendarTimezone]
    )

    const viewportMiniDate = useMemo(
        () => dayjs.tz(viewportMini, calendarTimezone).add(12, "hour").toDate(),
        [viewportMini, calendarTimezone]
    )

    const onClickToday = () => {
        const nowTz = today

        setViewportMiniDate(nowTz.startOf("month").toDate())
        setViewportDate(nowTz.toDate())
        setSelectedDate(nowTz.clone().add(1, "day").toDate())
        requestAnimationFrame(() => {
            setSelectedDate(nowTz.toDate())
        })
    }

    const handleSelect = useCallback(
        (d?: Date) => {
            if (!d) return
            setSelectedDate(d)
            setViewportDate(d)
        },
        [setSelectedDate, setViewportDate]
    )

    const handleMonthSelected = useCallback(
        (d?: Date) => {
            if (!d) return
            setSelectedDate(d)
            setViewportMiniDate(d)
            setViewportDate(d)
        },
        [setSelectedDate, setViewportMiniDate, setViewportDate]
    )

    const handleYearSelected = useCallback(
        (d?: Date) => {
            if (!d) return
            setViewportMiniDate(d)
        },
        [setViewportMiniDate]
    )

    const handleClickNav = useCallback(
        (currentDate: Date, direction: string, mode: CalendarPickerMode) => {
            let date = dayjs.tz(currentDate, calendarTimezone)
            const number = mode === "month" ? 1 : 12
            if (direction === "prev") {
                date = date.subtract(number, "year")
            } else if (direction === "next") {
                date = date.add(number, "year")
            }
            setViewportMiniDate(date.toDate())
        },
        [setViewportMiniDate, calendarTimezone]
    )

    const canCreateEvent =
        activeCalendar?.id === "demo" ||
        canCreateCalendarEvents(activeCalendarMembership)

    const joinAction = useMemo(() => {
        if (!user || !activeCalendar || activeCalendar.id === "demo") {
            return null
        }

        if (activeCalendarMembership.isMember) {
            return null
        }

        if (activeCalendarMembership.status === "pending") {
            return {
                label: "가입 요청 중",
                disabled: true,
            }
        }

        if (activeCalendar.accessMode === "public_open") {
            return {
                label: "캘린더 참여하기",
                disabled: false,
            }
        }

        if (activeCalendar.accessMode === "public_approval") {
            return {
                label: "가입 요청하기",
                disabled: false,
            }
        }

        return null
    }, [user, activeCalendar, activeCalendarMembership])

    const handleJoinCalendar = useCallback(async () => {
        if (
            !user ||
            !activeCalendar ||
            activeCalendar.id === "demo" ||
            !joinAction ||
            joinAction.disabled
        ) {
            return
        }

        setIsJoiningCalendar(true)

        try {
            const supabase = createBrowserSupabase()
            const membership = await createCalendarMembership(
                supabase,
                activeCalendar.id
            )

            if (!membership) {
                toast.error("캘린더 가입을 처리하지 못했습니다.")
                return
            }

            applyActiveCalendarMembership(membership)

            toast.success(
                membership.isMember
                    ? "캘린더에 참여했습니다."
                    : "가입 요청을 보냈습니다."
            )
        } catch (error) {
            console.error("Failed to join calendar:", error)
            toast.error("캘린더 가입을 처리하지 못했습니다.")
        } finally {
            setIsJoiningCalendar(false)
        }
    }, [user, activeCalendar, joinAction, applyActiveCalendarMembership])

    return (
        <SidebarGroup className="px-0 pt-0">
            <SidebarGroupContent>
                <Calendar
                    timeZone={calendarTimezone}
                    mode="single"
                    month={month}
                    onMonthChange={setViewportMiniDate}
                    onMonthSelected={handleMonthSelected}
                    onYearSelected={handleYearSelected}
                    onClickToday={onClickToday}
                    onClickNav={handleClickNav}
                    showTodayButton={!isToday}
                    selected={selected}
                    selectedDate={selected}
                    viewportDate={viewportMiniDate}
                    onSelect={handleSelect}
                    // captionLayout="dropdown"
                    className="bg-transparent py-1! [--cell-size:2.1rem]"
                />

                <div className="flex flex-col gap-1 px-2">
                    {canCreateEvent && (
                        <Button variant="outline" onClick={() => createEvent()}>
                            <CalendarPlusIcon />
                            일정 생성하기
                        </Button>
                    )}
                    {joinAction && (
                        <Button
                            variant="default"
                            onClick={handleJoinCalendar}
                            disabled={joinAction.disabled || isJoiningCalendar}
                        >
                            {isJoiningCalendar ? (
                                <Spinner />
                            ) : (
                                <CalendarCheck2Icon />
                            )}
                            {joinAction.label}
                        </Button>
                    )}
                </div>
            </SidebarGroupContent>
        </SidebarGroup>
    )
})
