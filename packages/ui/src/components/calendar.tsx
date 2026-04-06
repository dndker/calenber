"use client"

import * as React from "react"
import {
    DayPicker,
    MonthGrid as DefaultMonthGrid,
    getDefaultClassNames,
    type DayButton,
    type Locale,
} from "react-day-picker"

import { Button, buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import clsx from "clsx"
import dayjs from "dayjs"
import {
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
} from "lucide-react"
import { ko } from "react-day-picker/locale"

export type CalendarPickerMode = "day" | "month" | "year"

const Calendar = React.memo(function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    captionLayout = "label",
    buttonVariant = "ghost",
    locale = ko,
    formatters,
    components,
    month,
    selectedDate,
    onMonthChange,
    onMonthSelected,
    onYearSelected,
    onClickToday,
    onClickNav,
    showTodayButton,
    ...props
}: React.ComponentProps<typeof DayPicker> & {
    selectedDate: Date
    buttonVariant?: React.ComponentProps<typeof Button>["variant"]
    onClickToday?: () => void
    onClickNav?: (
        currentDate: Date,
        direction: string,
        mode: CalendarPickerMode
    ) => void
    onMonthSelected?: (date: Date, mode: CalendarPickerMode) => void
    onYearSelected?: (date: Date, mode?: CalendarPickerMode) => void
    showTodayButton?: boolean
}) {
    const defaultClassNames = getDefaultClassNames()
    const [mode, setMode] = React.useState<CalendarPickerMode>("day")

    return (
        <DayPicker
            month={month}
            onMonthChange={onMonthChange}
            showOutsideDays={showOutsideDays}
            className={cn(
                "group/calendar w-full bg-background p-2 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(7)] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent",
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
                    "size-7 p-0 select-none aria-disabled:opacity-50",
                    defaultClassNames.button_previous
                ),
                button_next: cn(
                    buttonVariants({ variant: buttonVariant }),
                    "size-7 p-0 select-none aria-disabled:opacity-50",
                    defaultClassNames.button_next
                ),
                month_caption: cn(
                    "flex h-(--cell-size) w-full items-center pl-1",
                    defaultClassNames.month_caption
                ),
                dropdowns: cn(
                    "flex h-(--cell-size) items-center justify-center text-sm font-medium",
                    defaultClassNames.dropdowns
                ),
                dropdown_root: cn(
                    "relative rounded-(--cell-radius) p-1",
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
                Nav: ({ onPreviousClick, onNextClick }) => {
                    return (
                        <div className="absolute top-0.75 right-0 flex w-auto items-center">
                            {showTodayButton && mode == "day" && (
                                <Button
                                    onClick={() => {
                                        onClickToday?.()
                                        setMode("day")
                                    }}
                                    variant="ghost"
                                    className="h-7 p-0 px-1 text-xs select-none aria-disabled:opacity-50"
                                >
                                    오늘
                                </Button>
                            )}

                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={
                                    mode === "day"
                                        ? onPreviousClick
                                        : () =>
                                              onClickNav?.(month!, "prev", mode)
                                }
                                className="size-7 p-0 select-none aria-disabled:opacity-50"
                            >
                                <ChevronLeftIcon />
                            </Button>
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={
                                    mode === "day"
                                        ? onNextClick
                                        : () =>
                                              onClickNav?.(month!, "next", mode)
                                }
                                className="size-7 p-0 select-none aria-disabled:opacity-50"
                            >
                                <ChevronRightIcon />
                            </Button>
                        </div>
                    )
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
                MonthCaption({ calendarMonth }) {
                    const date = dayjs(calendarMonth.date)
                    const year = date.format("YYYY년")
                    const month = date.format("M월")
                    return (
                        <div className="flex items-center -space-x-1.75 *:px-1.5!">
                            <Button
                                variant="ghost"
                                onClick={() =>
                                    setMode(mode === "year" ? "day" : "year")
                                }
                                className={clsx({
                                    "bg-muted underline dark:hover:bg-muted/50":
                                        mode === "year",
                                })}
                            >
                                {year}
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() =>
                                    setMode(mode === "month" ? "day" : "month")
                                }
                                className={clsx({
                                    "bg-muted underline dark:hover:bg-muted/50":
                                        mode === "month",
                                })}
                            >
                                {month}
                            </Button>
                        </div>
                    )
                },
                MonthGrid: ({ ...props }) => {
                    if (mode === "month") {
                        return (
                            <CalendarMonthGrid
                                selectedDate={selectedDate}
                                month={month || new Date()}
                                onMonthChange={(date) => {
                                    onMonthSelected?.(date, "month")
                                    setMode("day")
                                }}
                            />
                        )
                    }
                    if (mode === "year") {
                        return (
                            <CalendarYearGrid
                                selectedDate={selectedDate}
                                year={month || new Date()}
                                onYearChange={(date) => {
                                    onYearSelected?.(date)
                                    setMode("month")
                                }}
                            />
                        )
                    }

                    return <DefaultMonthGrid {...props} />
                },
                ...components,
            }}
            navLayout="after"
            {...props}
        />
    )
})

const CalendarYearGrid = React.memo(function CalendarYearGrid({
    selectedDate,
    year,
    onYearChange,
}: {
    selectedDate: Date
    year: Date
    onYearChange?: (date: Date) => void
}) {
    const current = dayjs(year)
    const currentYear = current.year()

    const selected = dayjs(selectedDate)
    const selectedYear = selected.year()

    // ✅ 현재 year가 포함된 9개 묶음 시작점
    const baseYear = Math.floor(currentYear / 12) * 12

    const years = Array.from({ length: 12 }, (_, i) => baseYear + i)
    // years[0]! + 9

    return (
        <div className="mb-1 grid grid-cols-4 gap-2.5">
            {years.map((y) => {
                const isSelected = y === selectedYear

                return (
                    <Button
                        variant="ghost"
                        key={y}
                        onClick={() => {
                            const newDate = current.year(y).toDate()
                            onYearChange?.(newDate)
                        }}
                        data-selected-single={isSelected}
                        className={cn(
                            "relative isolate z-10 flex aspect-square h-auto items-center justify-center rounded-lg border-0 text-sm font-normal",
                            "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground",
                            isSelected &&
                                "bg-primary font-medium text-primary-foreground"
                        )}
                    >
                        {y}
                    </Button>
                )
            })}
        </div>
    )
})

const CalendarMonthGrid = React.memo(function CalendarMonthGrid({
    selectedDate,
    month,
    onMonthChange,
}: {
    selectedDate: Date
    month: Date
    onMonthChange?: (date: Date) => void
}) {
    const current = dayjs(month).startOf("month")

    const selected = dayjs(selectedDate)
    const selectedMonth = selected.month()
    const selectedYear = selected.year()

    const months = Array.from({ length: 12 }, (_, i) => i)

    return (
        <div className="mb-1 grid grid-cols-4 gap-2.5">
            {months.map((m) => {
                const isSelected =
                    m === selectedMonth && current.year() === selectedYear

                return (
                    <Button
                        variant="ghost"
                        key={m}
                        onClick={() => {
                            const newDate = current.month(m).toDate()
                            onMonthChange?.(newDate)
                        }}
                        data-selected-single={isSelected}
                        className={cn(
                            "dark:not[data-selected=true]:hover:text-foreground relative isolate z-10 flex aspect-square h-auto flex-col gap-1 rounded-md border-0 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50 data-[range-end=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-r-(--cell-radius) data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-muted data-[range-middle=true]:text-foreground data-[range-start=true]:rounded-(--cell-radius) data-[range-start=true]:rounded-l-(--cell-radius) data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground [&>span]:text-xs [&>span]:opacity-70",
                            isSelected &&
                                "bg-primary font-medium text-primary-foreground"
                        )}
                    >
                        {m + 1}월
                    </Button>
                )
            })}
        </div>
    )
})

const CalendarDayButton = React.memo(function CalendarDayButton({
    className,
    day,
    modifiers,
    locale,
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

export { Calendar, CalendarDayButton }
