import { useNow } from "@/hooks/use-now"
import dayjs from "@/lib/dayjs"
import { useCalendarStore } from "@/store/useCalendarStore"
import { Button } from "@workspace/ui/components/button"
import { Calendar, CalendarPickerMode } from "@workspace/ui/components/calendar"
import {
    SidebarGroup,
    SidebarGroupContent,
} from "@workspace/ui/components/sidebar"
import { CalendarPlus } from "lucide-react"
import { useCallback, useMemo } from "react"

export function DatePicker() {
    const now = useNow()
    const selectedDate = useCalendarStore((s) => s.selectedDate)
    const viewportMini = useCalendarStore((s) => s.viewportMini)
    const setSelectedDate = useCalendarStore((s) => s.setSelectedDate)
    const setViewportDate = useCalendarStore((s) => s.setViewportDate)
    const setViewportMiniDate = useCalendarStore((s) => s.setViewportMiniDate)

    const isToday = useMemo(() => {
        return (
            dayjs(now).isSame(selectedDate, "day") &&
            dayjs(now).isSame(viewportMini, "month")
        )
    }, [now, selectedDate, viewportMini])
    const viewportMiniDate = useMemo(() => {
        return dayjs(viewportMini).toDate()
    }, [viewportMini])

    const selected = useMemo(() => dayjs(selectedDate).toDate(), [selectedDate])
    const month = useMemo(
        () => dayjs(viewportMini).startOf("month").toDate(),
        [viewportMini]
    )

    const onClickToday = () => {
        setViewportMiniDate(now.startOf("month").toDate())
        setViewportDate(now.toDate())
        setSelectedDate(now.clone().add(1, "day").toDate())
        requestAnimationFrame(() => {
            setSelectedDate(now.toDate())
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
            let date = dayjs(currentDate)
            const number = mode === "month" ? 1 : 12
            if (direction === "prev") {
                date = date.subtract(number, "year")
            } else if (direction === "next") {
                date = date.add(number, "year")
            }
            setViewportMiniDate(date.toDate())
        },
        [setViewportMiniDate]
    )

    return (
        <SidebarGroup className="px-0">
            <SidebarGroupContent>
                <Calendar
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
                    <Button variant="outline">
                        <CalendarPlus />
                        일정 생성하기
                    </Button>
                </div>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}
