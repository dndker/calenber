"use client"

import dayjs from "dayjs"
import * as React from "react"
import {
    DayPicker,
    MonthGrid as DefaultMonthGrid,
    getDefaultClassNames,
    useDayPicker,
    type DateRange,
    type DayButton,
    type Locale,
} from "react-day-picker"

import { Button, buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import {
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
} from "lucide-react"
import { ko } from "react-day-picker/locale"

type CalendarPickerMode = "day" | "month" | "year"

function CalendarPicker({
    className,
    classNames,
    showOutsideDays = true,
    captionLayout = "label",
    buttonVariant = "ghost",
    locale = ko,
    formatters,
    components,
    ...props
}: React.ComponentProps<typeof DayPicker> & {
    buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
    const defaultClassNames = getDefaultClassNames()
    const [pickerMode, setPickerMode] =
        React.useState<CalendarPickerMode>("day")
    const selectedValue =
        "selected" in props
            ? (
                  props as {
                      selected?: unknown
                  }
              ).selected
            : undefined
    const selectedDate = React.useMemo(
        () => getCalendarPickerSelectedDate(selectedValue, props.month),
        [props.month, selectedValue]
    )
    const showTodayButton = React.useMemo(
        () => !isTodayIncludedInSelection(selectedValue),
        [selectedValue]
    )

    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            className={cn(
                "group/calendar bg-background p-2 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(7)] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent",
                String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
                String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
                className
            )}
            captionLayout={captionLayout}
            locale={locale}
            formatters={{
                formatMonthDropdown: (date) =>
                    date.toLocaleString(locale?.code, { month: "short" }),
                ...formatters,
            }}
            classNames={{
                root: cn("w-fit", defaultClassNames.root),
                months: cn(
                    "relative flex flex-col gap-4 md:flex-row",
                    defaultClassNames.months
                ),
                month: cn(
                    "flex w-full flex-col gap-2",
                    defaultClassNames.month
                ),
                nav: cn(
                    "absolute top-[3px] right-0 flex w-auto items-center",
                    defaultClassNames.nav
                ),
                button_previous: cn(
                    buttonVariants({ variant: buttonVariant }),
                    "size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
                    defaultClassNames.button_previous
                ),
                button_next: cn(
                    buttonVariants({ variant: buttonVariant }),
                    "size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
                    defaultClassNames.button_next
                ),
                month_caption: cn(
                    "flex h-(--cell-size) w-full items-center pl-1",
                    defaultClassNames.month_caption
                ),
                dropdowns: cn(
                    "flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium",
                    defaultClassNames.dropdowns
                ),
                dropdown_root: cn(
                    "relative rounded-(--cell-radius)",
                    defaultClassNames.dropdown_root
                ),
                dropdown: cn(
                    "absolute inset-0 bg-popover opacity-0",
                    defaultClassNames.dropdown
                ),
                caption_label: cn(
                    "font-medium select-none",
                    captionLayout === "label"
                        ? "text-sm"
                        : "flex items-center gap-1 rounded-(--cell-radius) text-sm [&>svg]:size-3.5 [&>svg]:text-muted-foreground",
                    defaultClassNames.caption_label
                ),
                table: "w-full border-collapse",
                weekdays: cn("flex", defaultClassNames.weekdays),
                weekday: cn(
                    "flex-1 rounded-(--cell-radius) text-[0.8rem] font-normal text-muted-foreground select-none",
                    defaultClassNames.weekday
                ),
                week: cn("mt-2 flex w-full", defaultClassNames.week),
                week_number_header: cn(
                    "w-(--cell-size) select-none",
                    defaultClassNames.week_number_header
                ),
                week_number: cn(
                    "text-[0.8rem] text-muted-foreground select-none",
                    defaultClassNames.week_number
                ),
                day: cn(
                    "group/day relative aspect-square h-full w-full rounded-(--cell-radius) p-0 text-center select-none [&:last-child[data-selected=true]_button]:rounded-r-(--cell-radius)",
                    props.showWeekNumber
                        ? "[&:nth-child(2)[data-selected=true]_button]:rounded-l-(--cell-radius)"
                        : "[&:first-child[data-selected=true]_button]:rounded-l-(--cell-radius)",
                    defaultClassNames.day
                ),
                range_start: cn(
                    "relative isolate z-0 rounded-l-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:right-0 after:w-4 after:bg-muted",
                    defaultClassNames.range_start
                ),
                range_middle: cn(
                    "rounded-none",
                    defaultClassNames.range_middle
                ),
                range_end: cn(
                    "relative isolate z-0 rounded-r-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:left-0 after:w-4 after:bg-muted",
                    defaultClassNames.range_end
                ),
                today: cn(
                    "rounded-(--cell-radius) bg-muted text-foreground data-[selected=true]:rounded-none",
                    defaultClassNames.today
                ),
                outside: cn(
                    "text-muted-foreground aria-selected:text-muted-foreground",
                    defaultClassNames.outside
                ),
                disabled: cn(
                    "text-muted-foreground opacity-50",
                    defaultClassNames.disabled
                ),
                hidden: cn("invisible", defaultClassNames.hidden),
                ...classNames,
            }}
            components={{
                Root: ({ className, rootRef, ...props }) => {
                    return (
                        <div
                            data-slot="calendar"
                            ref={rootRef}
                            className={cn(className)}
                            {...props}
                        />
                    )
                },
                Nav: () => (
                    <CalendarPickerNav
                        buttonVariant={buttonVariant}
                        mode={pickerMode}
                        onModeChange={setPickerMode}
                        showTodayButton={showTodayButton}
                    />
                ),
                MonthCaption: () => (
                    <CalendarPickerMonthCaption
                        mode={pickerMode}
                        onModeChange={setPickerMode}
                    />
                ),
                MonthGrid: ({ ...monthGridProps }) => {
                    if (pickerMode === "month") {
                        return (
                            <CalendarPickerMonthGrid
                                month={props.month ?? selectedDate}
                                selectedDate={selectedDate}
                                onMonthSelected={() => {
                                    setPickerMode("day")
                                }}
                            />
                        )
                    }

                    if (pickerMode === "year") {
                        return (
                            <CalendarPickerYearGrid
                                year={props.month ?? selectedDate}
                                selectedDate={selectedDate}
                                onYearSelected={() => {
                                    setPickerMode("month")
                                }}
                            />
                        )
                    }

                    return <DefaultMonthGrid {...monthGridProps} />
                },
                Chevron: ({ className, orientation, ...props }) => {
                    if (orientation === "left") {
                        return (
                            <ChevronLeftIcon
                                className={cn("size-4", className)}
                                {...props}
                            />
                        )
                    }

                    if (orientation === "right") {
                        return (
                            <ChevronRightIcon
                                className={cn("size-4", className)}
                                {...props}
                            />
                        )
                    }

                    return (
                        <ChevronDownIcon
                            className={cn("size-4", className)}
                            {...props}
                        />
                    )
                },
                DayButton: ({ ...props }) => (
                    <CalendarDayButton locale={locale} {...props} />
                ),
                WeekNumber: ({ children, ...props }) => {
                    return (
                        <td {...props}>
                            <div className="flex size-(--cell-size) items-center justify-center text-center">
                                {children}
                            </div>
                        </td>
                    )
                },
                ...components,
            }}
            {...props}
        />
    )
}

function getCalendarPickerSelectedDate(selected: unknown, month?: Date) {
    if (selected instanceof Date) {
        return selected
    }

    if (isDateRange(selected)) {
        return selected.from ?? selected.to ?? month ?? new Date()
    }

    if (Array.isArray(selected)) {
        return selected[0] ?? month ?? new Date()
    }

    if (selected && typeof selected === "object") {
        if ("from" in selected && selected.from instanceof Date) {
            return selected.from
        }

        if ("to" in selected && selected.to instanceof Date) {
            return selected.to
        }
    }

    return month ?? new Date()
}

function isDateRange(selected: unknown): selected is DateRange {
    return Boolean(
        selected &&
        typeof selected === "object" &&
        ("from" in selected || "to" in selected)
    )
}

function isTodayIncludedInSelection(selected: unknown) {
    const today = dayjs()

    if (selected instanceof Date) {
        return today.isSame(selected, "day")
    }

    if (Array.isArray(selected)) {
        return selected.some((value) => dayjs(value).isSame(today, "day"))
    }

    if (isDateRange(selected)) {
        if (!selected.from && !selected.to) {
            return false
        }

        if (selected.from && !selected.to) {
            return dayjs(selected.from).isSame(today, "day")
        }

        if (!selected.from && selected.to) {
            return dayjs(selected.to).isSame(today, "day")
        }

        const from = dayjs(selected.from).startOf("day").valueOf()
        const to = dayjs(selected.to).endOf("day").valueOf()
        const now = today.valueOf()
        return now >= from && now <= to
    }

    return false
}

function CalendarPickerMonthCaption({
    mode,
    onModeChange,
}: {
    mode: CalendarPickerMode
    onModeChange: React.Dispatch<React.SetStateAction<CalendarPickerMode>>
}) {
    const { months } = useDayPicker()
    const currentMonth = months[0]?.date ?? new Date()
    const year = dayjs(currentMonth).year()
    const month = dayjs(currentMonth).format("M월")
    const baseYear = Math.floor(year / 12) * 12
    const years = Array.from({ length: 12 }, (_, index) => baseYear + index)

    return (
        <div className="flex min-w-0 items-center -space-x-1.75 pr-24 *:px-1.5!">
            <Button
                variant="ghost"
                onClick={() => onModeChange(mode === "year" ? "day" : "year")}
                className={cn("text-[13px]", {
                    "bg-muted dark:hover:bg-muted/50": mode === "year",
                    "opacity-50": mode === "month",
                })}
            >
                {mode === "year" ? `${years[0]}년~${years[11]}년` : `${year}년`}
            </Button>
            <Button
                variant="ghost"
                onClick={() => onModeChange(mode === "month" ? "day" : "month")}
                className={cn({
                    "bg-muted dark:hover:bg-muted/50": mode === "month",
                    "opacity-50": mode === "year",
                })}
            >
                {month}
            </Button>
        </div>
    )
}

function CalendarPickerNav({
    buttonVariant,
    mode,
    onModeChange,
    showTodayButton,
}: {
    buttonVariant: React.ComponentProps<typeof Button>["variant"]
    mode: CalendarPickerMode
    onModeChange: React.Dispatch<React.SetStateAction<CalendarPickerMode>>
    showTodayButton: boolean
}) {
    const { goToMonth, months, nextMonth, previousMonth } = useDayPicker()
    const currentMonth = months[0]?.date ?? new Date()

    const handleNavigate = (direction: "prev" | "next") => {
        if (mode === "day") {
            const targetMonth = direction === "prev" ? previousMonth : nextMonth

            if (targetMonth) {
                goToMonth(targetMonth)
            }

            return
        }

        if (mode === "month") {
            goToMonth(
                dayjs(currentMonth)
                    [direction === "prev" ? "subtract" : "add"](1, "year")
                    .toDate()
            )
            return
        }

        goToMonth(
            dayjs(currentMonth)
                [direction === "prev" ? "subtract" : "add"](12, "year")
                .toDate()
        )
    }

    return (
        <div className="absolute top-0 right-0 flex items-center gap-0.5">
            {showTodayButton ? (
                <Button
                    variant={buttonVariant}
                    className="h-7 px-1.5 text-xs"
                    onClick={() => {
                        goToMonth(new Date())
                        onModeChange("day")
                    }}
                >
                    오늘
                </Button>
            ) : null}
            <Button
                size="icon"
                variant={buttonVariant}
                onClick={() => handleNavigate("prev")}
                disabled={mode === "day" && !previousMonth}
                className="size-7 p-0 select-none"
            >
                <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
                size="icon"
                variant={buttonVariant}
                onClick={() => handleNavigate("next")}
                disabled={mode === "day" && !nextMonth}
                className="size-7 p-0 select-none"
            >
                <ChevronRightIcon className="size-4" />
            </Button>
        </div>
    )
}

function CalendarPickerYearGrid({
    selectedDate,
    year,
    onYearSelected,
}: {
    selectedDate: Date
    year: Date
    onYearSelected?: () => void
}) {
    const { goToMonth } = useDayPicker()
    const currentYear = dayjs(year).year()
    const selectedYear = dayjs(selectedDate).year()
    const baseYear = Math.floor(currentYear / 12) * 12
    const years = Array.from({ length: 12 }, (_, index) => baseYear + index)

    return (
        <div className="mb-1 grid grid-cols-4 gap-2.5">
            {years.map((value) => {
                const today = dayjs()
                const isToday = value === today.year()
                const isSelected = value === selectedYear

                return (
                    <CalendarPickerGridButton
                        key={value}
                        isSelected={isSelected}
                        isToday={isToday}
                        onClick={() => {
                            goToMonth(dayjs(year).year(value).toDate())
                            onYearSelected?.()
                        }}
                    >
                        {value}
                    </CalendarPickerGridButton>
                )
            })}
        </div>
    )
}

function CalendarPickerMonthGrid({
    selectedDate,
    month,
    onMonthSelected,
}: {
    selectedDate: Date
    month: Date
    onMonthSelected?: () => void
}) {
    const { goToMonth } = useDayPicker()
    const current = dayjs(month).startOf("month")
    const selectedMonth = dayjs(selectedDate).month()
    const selectedYear = dayjs(selectedDate).year()

    return (
        <div className="mb-1 grid grid-cols-4 gap-2.5">
            {Array.from({ length: 12 }, (_, index) => {
                const today = dayjs()
                const isSelected =
                    index === selectedMonth && current.year() === selectedYear
                const isToday =
                    index === today.month() && current.year() === today.year()

                return (
                    <CalendarPickerGridButton
                        key={index}
                        isSelected={isSelected}
                        isToday={isToday}
                        onClick={() => {
                            goToMonth(current.month(index).toDate())
                            onMonthSelected?.()
                        }}
                    >
                        {index + 1}월
                    </CalendarPickerGridButton>
                )
            })}
        </div>
    )
}

function CalendarPickerGridButton({
    className,
    isSelected,
    isToday,
    onClick,
    children,
}: {
    className?: string
    isSelected: boolean
    isToday: boolean
    onClick: () => void
    children: React.ReactNode
}) {
    return (
        <Button
            variant="ghost"
            onClick={onClick}
            data-selected-single={isSelected}
            className={cn(
                "dark:not[data-selected=true]:hover:text-foreground relative isolate z-10 flex aspect-square h-auto flex-col gap-1 rounded-md border-0 leading-none font-normal data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground",
                isSelected && "bg-primary font-medium text-primary-foreground",
                isToday && "bg-muted dark:hover:bg-muted/50",
                className
            )}
        >
            {children}
        </Button>
    )
}

const CalendarDayButton = React.memo(function CalendarDayButton({
    className,
    day,
    modifiers,
    locale = ko,
    ...props
}: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }) {
    const defaultClassNames = getDefaultClassNames()

    const ref = React.useRef<HTMLButtonElement>(null)
    React.useEffect(() => {
        if (modifiers.focused) ref.current?.focus()
    }, [modifiers.focused])

    return (
        <Button
            ref={ref}
            variant="ghost"
            size="icon"
            data-day={day.date.toLocaleDateString(locale?.code)}
            data-selected-single={
                modifiers.selected &&
                !modifiers.range_start &&
                !modifiers.range_end &&
                !modifiers.range_middle
            }
            data-range-start={modifiers.range_start}
            data-range-end={modifiers.range_end}
            data-range-middle={modifiers.range_middle}
            className={cn(
                "dark:not[data-selected=true]:hover:text-foreground relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 border-0 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50 data-[range-end=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-r-(--cell-radius) data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-muted data-[range-middle=true]:text-foreground data-[range-start=true]:rounded-(--cell-radius) data-[range-start=true]:rounded-l-(--cell-radius) data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:font-medium data-[selected-single=true]:text-primary-foreground [&>span]:text-xs [&>span]:opacity-70",
                defaultClassNames.day,
                className
            )}
            {...props}
        />
    )
})

export { CalendarPicker }
