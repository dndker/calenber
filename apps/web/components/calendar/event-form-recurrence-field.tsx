"use client"

import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { useNow } from "@/hooks/use-now"
import dayjs from "@/lib/dayjs"
import {
    CheckIcon,
    ChevronRightIcon,
    Settings2Icon,
    TrashIcon,
    type LucideIcon,
} from "lucide-react"
import { useState } from "react"
import { Controller, type Control } from "react-hook-form"
import { toast } from "sonner"

import {
    EventFormPropertyRow,
    type EventFormPropertyMenuItem,
    type EventFormPropertyVisibility,
} from "./event-form-property-row"
import {
    createRecurrenceValue,
    formatRecurrenceEndShortText,
    formatRecurrenceMenuShortText,
    formatRecurrenceSummary,
    getDefaultRecurrenceUntil,
    getRecurrenceEndMode,
    getRecurrenceFallbackWeekday,
    getRecurrenceMinimumUntilDate,
    normalizeRecurrenceWeekdays,
    recurrenceIntervalUnitLabelMap,
    recurrenceWeekdayItemsTextOrdered,
} from "./event-form-recurrence"
import type { EventFormValues } from "./event-form.schema"

import { Button } from "@workspace/ui/components/button"
import { CalendarPicker } from "@workspace/ui/components/calendar-picker"
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    InputGroupText,
} from "@workspace/ui/components/input-group"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@workspace/ui/components/select"
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import {
    ToggleGroup,
    ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { cn } from "@workspace/ui/lib/utils"
import { useLocale } from "next-intl"

type EventFormRecurrenceFieldProps = {
    control: Control<EventFormValues>
    disabled: boolean
    label: string
    icon: LucideIcon
    visibility: EventFormPropertyVisibility
    onVisibilityChange: (nextVisibility: EventFormPropertyVisibility) => void
    propertyMenuItems: EventFormPropertyMenuItem[]
    watchedStart: Date
    watchedTimezone: string
    onRecurrenceChange: (recurrence: EventFormValues["recurrence"]) => void
}

export function EventFormRecurrenceField({
    control,
    disabled,
    label,
    icon,
    visibility,
    onVisibilityChange,
    propertyMenuItems,
    watchedStart,
    watchedTimezone,
    onRecurrenceChange,
}: EventFormRecurrenceFieldProps) {
    const locale = useLocale() as "ko" | "en"
    const tRecurrence = useDebugTranslations("event.recurrence")
    const tCommon = useDebugTranslations("common.actions")
    const tWeekday = useDebugTranslations("common.weekdays.short")
    const tForm = useDebugTranslations("event.form")
    const now = useNow(watchedTimezone)
    const [recurrenceOpen, setRecurrenceOpen] = useState(false)
    const [recurrenceStep, setRecurrenceStep] = useState(0)
    const [endDatePickerOpen, setEndDatePickerOpen] = useState(false)
    const recurrenceTypeOptions = [
        { value: "none", label: tRecurrence("none") },
        { value: "daily", label: tRecurrence("daily") },
        { value: "weekly", label: tRecurrence("weekly") },
        { value: "monthly", label: tRecurrence("monthly") },
        { value: "yearly", label: tRecurrence("yearly") },
    ] as const

    return (
        <Controller
            name="recurrence"
            control={control}
            render={({ field }) => {
                const startWeekday = getRecurrenceFallbackWeekday(
                    watchedStart,
                    watchedTimezone
                )
                const recurrenceValue = field.value
                const recurrenceEndMode = getRecurrenceEndMode(recurrenceValue)
                const minimumUntilDate = getRecurrenceMinimumUntilDate(
                    watchedStart,
                    watchedTimezone
                )
                const selectedUntilDate = recurrenceValue?.until
                    ? dayjs.tz(recurrenceValue.until, watchedTimezone).toDate()
                    : undefined

                const updateRecurrence = (
                    nextRecurrence: EventFormValues["recurrence"]
                ) => {
                    field.onChange(nextRecurrence)
                    onRecurrenceChange(nextRecurrence)
                }

                return (
                    <EventFormPropertyRow
                        fieldId="recurrence"
                        label={label}
                        icon={icon}
                        disabled={disabled}
                        visibility={visibility}
                        onVisibilityChange={onVisibilityChange}
                        propertyMenuItems={propertyMenuItems}
                    >
                        <Popover
                            open={recurrenceOpen}
                            onOpenChange={(open) => {
                                setRecurrenceOpen(open)
                                if (!open) {
                                    setRecurrenceStep(
                                        recurrenceValue?.type ? 1 : 0
                                    )
                                }
                            }}
                        >
                            <PopoverTrigger asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    disabled={disabled}
                                    className={cn(
                                        "w-full justify-start px-1.5 font-normal [word-spacing:-1px] hover:bg-transparent data-open:border-ring data-open:bg-input/10! data-open:ring-3 data-open:ring-ring/50",
                                        !recurrenceValue &&
                                            "text-muted-foreground"
                                    )}
                                >
                                    {formatRecurrenceSummary({
                                        recurrence: recurrenceValue,
                                        startDate: watchedStart,
                                        timezone: watchedTimezone,
                                        locale,
                                    })}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent
                                align="start"
                                className="w-48 gap-0 overflow-hidden p-0"
                                sideOffset={8}
                            >
                                <Sidebar
                                    collapsible="none"
                                    className="bg-transparent"
                                >
                                    <SidebarContent>
                                        {recurrenceStep === 0 && (
                                            <SidebarGroup className="p-1.5">
                                                <SidebarGroupContent className="gap-0">
                                                    <SidebarMenu>
                                                        <ToggleGroup
                                                            type="single"
                                                            size="default"
                                                            variant="outline"
                                                            className="flex w-full flex-col items-start gap-1 overflow-hidden rounded-none! [&_button]:w-full [&_button]:justify-start [&_button]:rounded-md! [&_button]:border-0! [&_button]:font-normal [&_button]:tracking-wide [&_button]:[word-spacing:-2px]"
                                                            value={
                                                                recurrenceValue?.type ??
                                                                "none"
                                                            }
                                                            onValueChange={(
                                                                value
                                                            ) => {
                                                                if (
                                                                    value ===
                                                                    recurrenceValue?.type
                                                                ) {
                                                                    return
                                                                }

                                                                if (!value) {
                                                                    setRecurrenceStep(
                                                                        1
                                                                    )
                                                                    return
                                                                }

                                                                if (
                                                                    value ===
                                                                    "none"
                                                                ) {
                                                                    updateRecurrence(
                                                                        undefined
                                                                    )
                                                                    setRecurrenceOpen(
                                                                        false
                                                                    )
                                                                    setRecurrenceStep(
                                                                        0
                                                                    )
                                                                    return
                                                                }

                                                                updateRecurrence(
                                                                    createRecurrenceValue(
                                                                        value as NonNullable<
                                                                            EventFormValues["recurrence"]
                                                                        >["type"],
                                                                        recurrenceValue,
                                                                        startWeekday
                                                                    )
                                                                )
                                                                setRecurrenceStep(
                                                                    1
                                                                )
                                                            }}
                                                            disabled={disabled}
                                                        >
                                                            {recurrenceTypeOptions.map(
                                                                (option) => {
                                                                    const isChecked =
                                                                        option.value ===
                                                                        "none"
                                                                            ? recurrenceValue?.type ===
                                                                              undefined
                                                                            : recurrenceValue?.type ===
                                                                              option.value

                                                                    return (
                                                                        <ToggleGroupItem
                                                                            key={
                                                                                option.value
                                                                            }
                                                                            className="group"
                                                                            value={
                                                                                option.value
                                                                            }
                                                                            aria-label={
                                                                                option.label
                                                                            }
                                                                        >
                                                                            <div className="flex items-center gap-1.5">
                                                                                {
                                                                                    option.label
                                                                                }
                                                                                {isChecked &&
                                                                                    recurrenceValue?.type && (
                                                                                        <span className="text-xs text-muted-foreground">
                                                                                            {formatRecurrenceMenuShortText(
                                                                                                {
                                                                                                    recurrence:
                                                                                                        recurrenceValue,
                                                                                                    startDate:
                                                                                                        watchedStart,
                                                                                                    timezone:
                                                                                                        watchedTimezone,
                                                                                                    locale,
                                                                                                }
                                                                                            )}
                                                                                        </span>
                                                                                    )}
                                                                            </div>

                                                                            {isChecked && (
                                                                                <div className="ml-auto flex shrink-0 items-center gap-1">
                                                                                    <CheckIcon className="group-hover:hidden" />
                                                                                    <ChevronRightIcon className="hidden group-hover:block" />
                                                                                </div>
                                                                            )}
                                                                        </ToggleGroupItem>
                                                                    )
                                                                }
                                                            )}
                                                        </ToggleGroup>
                                                    </SidebarMenu>
                                                </SidebarGroupContent>
                                            </SidebarGroup>
                                        )}

                                        {recurrenceStep === 1 &&
                                            recurrenceValue && (
                                                <>
                                                    <SidebarGroup className="border-b">
                                                        <SidebarGroupLabel className="h-auto px-1 py-px">
                                                            {tRecurrence(
                                                                "settingsTitle"
                                                            )}
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="-mr-1 ml-auto h-6 px-1 text-xs leading-[normal] text-muted-foreground"
                                                                onClick={() => {
                                                                    setRecurrenceStep(
                                                                        0
                                                                    )
                                                                }}
                                                            >
                                                                {tCommon("back")}
                                                            </Button>
                                                        </SidebarGroupLabel>
                                                        <SidebarGroupContent className="gap-0">
                                                            <SidebarMenu className="gap-1">
                                                                <SidebarMenuItem>
                                                                    <SidebarMenuButton
                                                                        onClick={() => {
                                                                            updateRecurrence(
                                                                                undefined
                                                                            )
                                                                            setRecurrenceOpen(
                                                                                false
                                                                            )
                                                                            setRecurrenceStep(
                                                                                0
                                                                            )
                                                                        }}
                                                                        className="gap-1 px-1 py-1.5 text-[12px]"
                                                                    >
                                                                        <TrashIcon className="size-4!" />
                                                                        {tRecurrence(
                                                                            "deleteAction"
                                                                        )}
                                                                    </SidebarMenuButton>
                                                                    <SidebarMenuButton
                                                                        onClick={() => {
                                                                            setRecurrenceStep(
                                                                                2
                                                                            )
                                                                        }}
                                                                        className="gap-1 px-1 py-1.5 text-[12px]"
                                                                    >
                                                                        <Settings2Icon className="size-4!" />
                                                                        {tRecurrence(
                                                                            "endSettings"
                                                                        )}
                                                                        <span className="text-[12px] text-muted-foreground">
                                                                            {formatRecurrenceEndShortText(
                                                                                {
                                                                                    recurrence:
                                                                                        recurrenceValue,
                                                                                    timezone:
                                                                                        watchedTimezone,
                                                                                    locale,
                                                                                }
                                                                            )}
                                                                        </span>
                                                                        <ChevronRightIcon className="ml-auto" />
                                                                    </SidebarMenuButton>
                                                                </SidebarMenuItem>
                                                                <SidebarMenuItem>
                                                                    <InputGroup className="gap-0">
                                                                        <InputGroupInput
                                                                            type="number"
                                                                            min={
                                                                                1
                                                                            }
                                                                            inputMode="numeric"
                                                                            value={String(
                                                                                recurrenceValue.interval ??
                                                                                    1
                                                                            )}
                                                                            disabled={
                                                                                disabled
                                                                            }
                                                                            onChange={(
                                                                                e
                                                                            ) => {
                                                                                updateRecurrence(
                                                                                    {
                                                                                        ...recurrenceValue,
                                                                                        interval:
                                                                                            Math.max(
                                                                                                1,
                                                                                                Number(
                                                                                                    e
                                                                                                        .target
                                                                                                        .value ||
                                                                                                        1
                                                                                                )
                                                                                            ),
                                                                                    }
                                                                                )
                                                                            }}
                                                                            placeholder="1"
                                                                            className="pr-0! leading-[normal]"
                                                                        />
                                                                        <InputGroupAddon align="inline-end">
                                                                            <InputGroupText className="leading-[normal]">
                                                                                {tRecurrence(
                                                                                    recurrenceIntervalUnitLabelMap[
                                                                                        recurrenceValue
                                                                                            .type
                                                                                    ]
                                                                                )}
                                                                                {tRecurrence(
                                                                                    "everySuffix"
                                                                                )}
                                                                            </InputGroupText>
                                                                        </InputGroupAddon>
                                                                    </InputGroup>
                                                                </SidebarMenuItem>
                                                            </SidebarMenu>
                                                        </SidebarGroupContent>
                                                    </SidebarGroup>
                                                    {recurrenceValue.type ===
                                                        "weekly" && (
                                                        <SidebarGroup>
                                                            <SidebarGroupContent className="gap-0">
                                                                <SidebarMenu>
                                                                    <ToggleGroup
                                                                        type="multiple"
                                                                        value={normalizeRecurrenceWeekdays(
                                                                            recurrenceValue.byWeekday,
                                                                            startWeekday
                                                                        ).map(
                                                                            String
                                                                        )}
                                                                        onValueChange={(
                                                                            values
                                                                        ) => {
                                                                            updateRecurrence(
                                                                                {
                                                                                    ...recurrenceValue,
                                                                                    byWeekday:
                                                                                        normalizeRecurrenceWeekdays(
                                                                                            values.map(
                                                                                                Number
                                                                                            ),
                                                                                            startWeekday
                                                                                        ),
                                                                                }
                                                                            )
                                                                        }}
                                                                        className="flex w-full flex-col items-start gap-1 overflow-hidden rounded-none! [&_button]:w-full [&_button]:justify-start [&_button]:rounded-md! [&_button]:border-0! [&_button]:font-normal [&_button]:tracking-wide [&_button]:[word-spacing:-2px]"
                                                                        disabled={
                                                                            disabled
                                                                        }
                                                                    >
                                                                        {recurrenceWeekdayItemsTextOrdered.map(
                                                                            (
                                                                                weekday
                                                                            ) => (
                                                                                <ToggleGroupItem
                                                                                    key={
                                                                                        weekday.value
                                                                                    }
                                                                                    value={String(
                                                                                        weekday.value
                                                                                    )}
                                                                                    className="group"
                                                                                >
                                                                                    {tWeekday(
                                                                                        weekday.shortLabelKey.split(
                                                                                            "."
                                                                                        )[
                                                                                            3
                                                                                        ] as
                                                                                            | "sun"
                                                                                            | "mon"
                                                                                            | "tue"
                                                                                            | "wed"
                                                                                            | "thu"
                                                                                            | "fri"
                                                                                            | "sat"
                                                                                    )}
                                                                                    {normalizeRecurrenceWeekdays(
                                                                                        recurrenceValue.byWeekday,
                                                                                        startWeekday
                                                                                    )
                                                                                        .map(
                                                                                            String
                                                                                        )
                                                                                        .includes(
                                                                                            String(
                                                                                                weekday.value
                                                                                            )
                                                                                        ) && (
                                                                                        <CheckIcon className="ml-auto size-4" />
                                                                                    )}
                                                                                </ToggleGroupItem>
                                                                            )
                                                                        )}
                                                                    </ToggleGroup>
                                                                </SidebarMenu>
                                                            </SidebarGroupContent>
                                                        </SidebarGroup>
                                                    )}
                                                </>
                                            )}

                                        {recurrenceStep === 2 &&
                                            recurrenceValue && (
                                                <SidebarGroup>
                                                    <SidebarGroupLabel className="h-auto px-1 py-px">
                                                        {tRecurrence(
                                                            "endSettings"
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="-mr-1 ml-auto h-6 px-1 text-xs leading-[normal] text-muted-foreground"
                                                            onClick={() => {
                                                                setRecurrenceStep(
                                                                    1
                                                                )
                                                            }}
                                                        >
                                                            {tCommon("back")}
                                                        </Button>
                                                    </SidebarGroupLabel>
                                                    <SidebarGroupContent className="gap-0">
                                                        <SidebarMenu className="gap-1">
                                                            <SidebarMenuItem>
                                                                <Select
                                                                    value={
                                                                        recurrenceEndMode
                                                                    }
                                                                    onValueChange={(
                                                                        value
                                                                    ) => {
                                                                        if (
                                                                            value ===
                                                                            "never"
                                                                        ) {
                                                                            updateRecurrence(
                                                                                {
                                                                                    ...recurrenceValue,
                                                                                    until: undefined,
                                                                                    count: undefined,
                                                                                }
                                                                            )
                                                                            return
                                                                        }

                                                                        if (
                                                                            value ===
                                                                            "until"
                                                                        ) {
                                                                            updateRecurrence(
                                                                                {
                                                                                    ...recurrenceValue,
                                                                                    until:
                                                                                        recurrenceValue.until ??
                                                                                        getDefaultRecurrenceUntil(
                                                                                            now,
                                                                                            watchedStart,
                                                                                            watchedTimezone
                                                                                        ),
                                                                                    count: undefined,
                                                                                }
                                                                            )
                                                                            return
                                                                        }

                                                                        updateRecurrence(
                                                                            {
                                                                                ...recurrenceValue,
                                                                                count:
                                                                                    recurrenceValue.count ??
                                                                                    10,
                                                                                until: undefined,
                                                                            }
                                                                        )
                                                                    }}
                                                                    disabled={
                                                                        disabled
                                                                    }
                                                                >
                                                                    <SelectTrigger className="w-full">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectGroup>
                                                                            <SelectItem value="never">
                                                                                {tRecurrence(
                                                                                    "endNever"
                                                                                )}
                                                                            </SelectItem>
                                                                            <SelectItem value="until">
                                                                                {tRecurrence(
                                                                                    "endUntil"
                                                                                )}
                                                                            </SelectItem>
                                                                            <SelectItem value="count">
                                                                                {tRecurrence(
                                                                                    "endCount"
                                                                                )}
                                                                            </SelectItem>
                                                                        </SelectGroup>
                                                                    </SelectContent>
                                                                </Select>
                                                            </SidebarMenuItem>
                                                            {recurrenceEndMode !==
                                                                "never" && (
                                                                <SidebarMenuItem>
                                                                    <div className="flex flex-1 flex-col gap-1">
                                                                        {recurrenceEndMode ===
                                                                            "until" && (
                                                                            <Popover
                                                                                open={
                                                                                    endDatePickerOpen
                                                                                }
                                                                                onOpenChange={
                                                                                    setEndDatePickerOpen
                                                                                }
                                                                            >
                                                                                <PopoverTrigger
                                                                                    asChild
                                                                                >
                                                                                    <Button
                                                                                        type="button"
                                                                                        variant="outline"
                                                                                        className="w-full justify-start px-2 text-sm font-normal"
                                                                                        disabled={
                                                                                            disabled
                                                                                        }
                                                                                    >
                                                                                        {selectedUntilDate
                                                                                            ? dayjs
                                                                                                  .tz(
                                                                                                      selectedUntilDate,
                                                                                                      watchedTimezone
                                                                                                  )
                                                                                                  .format(
                                                                                                      "YYYY.MM.DD"
                                                                                                  )
                                                                                            : tRecurrence(
                                                                                                  "pickEndDate"
                                                                                              )}
                                                                                    </Button>
                                                                                </PopoverTrigger>
                                                                                <PopoverContent
                                                                                    align="start"
                                                                                    className="w-auto overflow-hidden p-0"
                                                                                    sideOffset={
                                                                                        8
                                                                                    }
                                                                                >
                                                                                    <CalendarPicker
                                                                                        mode="single"
                                                                                        selected={
                                                                                            selectedUntilDate
                                                                                        }
                                                                                        defaultMonth={
                                                                                            selectedUntilDate ??
                                                                                            now.toDate()
                                                                                        }
                                                                                        disabled={{
                                                                                            before: minimumUntilDate,
                                                                                        }}
                                                                                        onSelect={(
                                                                                            date
                                                                                        ) => {
                                                                                            if (
                                                                                                !date
                                                                                            ) {
                                                                                                return
                                                                                            }

                                                                                            if (
                                                                                                dayjs(
                                                                                                    date
                                                                                                ).isBefore(
                                                                                                    minimumUntilDate,
                                                                                                    "day"
                                                                                                )
                                                                                            ) {
                                                                                                toast.error(
                                                                                                    tForm(
                                                                                                        "endDateBeforeStart"
                                                                                                    )
                                                                                                )
                                                                                                return
                                                                                            }

                                                                                            updateRecurrence(
                                                                                                {
                                                                                                    ...recurrenceValue,
                                                                                                    until: dayjs
                                                                                                        .tz(
                                                                                                            dayjs(
                                                                                                                date
                                                                                                            ).format(
                                                                                                                "YYYY-MM-DD"
                                                                                                            ) +
                                                                                                                "T23:59:59",
                                                                                                            watchedTimezone
                                                                                                        )
                                                                                                        .toISOString(),
                                                                                                    count: undefined,
                                                                                                }
                                                                                            )
                                                                                            setEndDatePickerOpen(
                                                                                                false
                                                                                            )
                                                                                        }}
                                                                                    />
                                                                                </PopoverContent>
                                                                            </Popover>
                                                                        )}
                                                                        {recurrenceEndMode ===
                                                                            "count" && (
                                                                            <>
                                                                                <InputGroupInput
                                                                                    placeholder={tRecurrence(
                                                                                        "endDatePlaceholder"
                                                                                    )}
                                                                                    type="number"
                                                                                    min={
                                                                                        1
                                                                                    }
                                                                                    inputMode="numeric"
                                                                                    value={String(
                                                                                        recurrenceValue.count ??
                                                                                            10
                                                                                    )}
                                                                                    disabled={
                                                                                        disabled
                                                                                    }
                                                                                    onChange={(
                                                                                        e
                                                                                    ) => {
                                                                                        updateRecurrence(
                                                                                            {
                                                                                                ...recurrenceValue,
                                                                                                count: Math.max(
                                                                                                    1,
                                                                                                    Number(
                                                                                                        e
                                                                                                            .target
                                                                                                            .value ||
                                                                                                            1
                                                                                                    )
                                                                                                ),
                                                                                                until: undefined,
                                                                                            }
                                                                                        )
                                                                                    }}
                                                                                />
                                                                                <InputGroupAddon align="inline-end">
                                                                                    <InputGroupText className="leading-[normal]">
                                                                                        {tRecurrence(
                                                                                            "countSuffix"
                                                                                        )}
                                                                                    </InputGroupText>
                                                                                </InputGroupAddon>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </SidebarMenuItem>
                                                            )}
                                                        </SidebarMenu>
                                                    </SidebarGroupContent>
                                                </SidebarGroup>
                                            )}
                                    </SidebarContent>
                                </Sidebar>
                            </PopoverContent>
                        </Popover>
                    </EventFormPropertyRow>
                )
            }}
        />
    )
}
