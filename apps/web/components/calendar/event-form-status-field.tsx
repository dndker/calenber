"use client"

import {
    getCalendarCollectionDotClassName,
    getCalendarCollectionLabelClassName,
} from "@/lib/calendar/collection-color"
import {
    eventStatus,
    eventStatusTranslationKey,
    type CalendarEventStatus,
} from "@/store/calendar-store.types"
import { ContextMenuItem } from "@workspace/ui/components/context-menu"
import { cn } from "@workspace/ui/lib/utils"
import { CheckIcon } from "lucide-react"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { EventChipsCombobox } from "./event-chips-combobox"

export function useEventFormStatusItems() {
    const t = useDebugTranslations("event.status")
    return eventStatus.map((status) => ({
        value: status,
        label: t(eventStatusTranslationKey[status]),
    }))
}

export type EventFormStatusItem = ReturnType<typeof useEventFormStatusItems>[number]

export const eventFormStatusLabelClassNameMap: Record<
    EventFormStatusItem["value"],
    string
> = {
    scheduled:
        "bg-muted text-muted-foreground [&_button]:hidden border-0 dark:bg-input/50",
    in_progress: getCalendarCollectionLabelClassName(
        "blue",
        "[&_button]:hidden border-0"
    ),
    completed: getCalendarCollectionLabelClassName(
        "green",
        "[&_button]:hidden border-0"
    ),
    cancelled: getCalendarCollectionLabelClassName(
        "red",
        "[&_button]:hidden border-0"
    ),
}

export const eventFormStatusItemClassNameMap: Record<
    EventFormStatusItem["value"],
    string
> = {
    scheduled:
        "inline-flex rounded-full bg-muted px-2 py-0.5 text-sm text-muted-foreground border-0 dark:bg-input/50",
    in_progress: getCalendarCollectionLabelClassName(
        "blue",
        "inline-flex rounded-full px-2 py-0.5 text-sm border-0"
    ),
    completed: getCalendarCollectionLabelClassName(
        "green",
        "inline-flex rounded-full px-2 py-0.5 text-sm border-0"
    ),
    cancelled: getCalendarCollectionLabelClassName(
        "red",
        "inline-flex rounded-full px-2 py-0.5 text-sm border-0"
    ),
}

export const eventFormStatusDotClassNameMap: Record<
    EventFormStatusItem["value"],
    string
> = {
    scheduled: "bg-muted-foreground/70",
    in_progress: getCalendarCollectionDotClassName("blue"),
    completed: getCalendarCollectionDotClassName("green"),
    cancelled: getCalendarCollectionDotClassName("red"),
}

type EventFormStatusChipsFieldProps = {
    value: CalendarEventStatus
    onChange: (next: CalendarEventStatus) => void
    disabled?: boolean
    portalContainer?: HTMLElement | null
}

/** EventForm 본문과 동일한 상태 칩 + 콤보박스 UI */
export function EventFormStatusChipsField({
    value,
    onChange,
    disabled = false,
    portalContainer,
}: EventFormStatusChipsFieldProps) {
    const eventFormStatusItems = useEventFormStatusItems()
    const statusValue = value ? [value] : []

    return (
        <div className="flex w-full flex-wrap justify-start gap-1.5">
            <EventChipsCombobox
                portalContainer={portalContainer}
                disabled={disabled}
                options={eventFormStatusItems.map((status) => ({
                    value: status.value,
                    label: status.label,
                }))}
                value={statusValue}
                emptyText="No items found."
                onValueChange={(values) => {
                    const last = values[values.length - 1]

                    if (!last) {
                        return
                    }

                    onChange(last as CalendarEventStatus)
                }}
                closeOnSelect
                showRemove={false}
                renderChipContent={(status) => (
                    <span className="inline-flex items-center gap-1.5">
                        <span
                            className={[
                                eventFormStatusDotClassNameMap[
                                    status.value as EventFormStatusItem["value"]
                                ],
                                "size-2 rounded-full",
                            ].join(" ")}
                        />
                        {status.label}
                    </span>
                )}
                renderItemContent={(status) => (
                    <span
                        className={[
                            eventFormStatusItemClassNameMap[
                                status.value as EventFormStatusItem["value"]
                            ],
                            "inline-flex h-6 items-center gap-1.5 text-sm",
                        ].join(" ")}
                    >
                        <span
                            className={[
                                eventFormStatusDotClassNameMap[
                                    status.value as EventFormStatusItem["value"]
                                ],
                                "inline-block size-2 rounded-full",
                            ].join(" ")}
                        />
                        {status.label}
                    </span>
                )}
                chipClassName={(status) =>
                    [
                        "flex h-full items-center gap-1.5 rounded-full px-2.5! pr-2.75! text-sm",
                        eventFormStatusLabelClassNameMap[
                            status.value as EventFormStatusItem["value"]
                        ],
                    ].join(" ")
                }
            />
        </div>
    )
}

type EventFormStatusCheckListFieldProps = {
    value: CalendarEventStatus
    onSelect: (next: CalendarEventStatus) => void
    disabled?: boolean
    /** 컨텍스트 메뉴 등 좁은 영역용 */
    className?: string
}

/**
 * 상태만 고르는 리스트 (선택 행에 체크 표시). 퀵 편집·모바일형 패널용.
 */
export function EventFormStatusCheckListField({
    value,
    onSelect,
    disabled = false,
    className,
}: EventFormStatusCheckListFieldProps) {
    const eventFormStatusItems = useEventFormStatusItems()
    return (
        <div
            className={cn("flex flex-col gap-0.5 p-0.5", className)}
            role="list"
        >
            {eventFormStatusItems.map((item) => {
                const selected = item.value === value

                return (
                    <ContextMenuItem
                        key={item.value}
                        role="listitem"
                        disabled={disabled}
                        onClick={() => {
                            onSelect(item.value)
                        }}
                        className="h-auto justify-between px-1.5 py-1"
                    >
                        <EventStatusItem value={item.value}></EventStatusItem>
                        {selected ? (
                            <CheckIcon className="size-4 shrink-0 text-muted-foreground" />
                        ) : (
                            <span className="size-4 shrink-0" aria-hidden />
                        )}
                    </ContextMenuItem>
                )
            })}
        </div>
    )
}

export function EventStatusItem({
    value,
    size = "default",
}: {
    value: CalendarEventStatus
    size?: "sm" | "default"
}) {
    const eventFormStatusItems = useEventFormStatusItems()
    const status = eventFormStatusItems.find((e) => e.value === value)
    return (
        <span
            className={cn(
                "inline-flex h-6 items-center gap-2 text-sm font-medium",
                eventFormStatusItemClassNameMap[value],
                size === "sm" && "h-5 gap-1.25 text-xs"
            )}
        >
            <span
                className={cn(
                    "inline-block size-2 shrink-0 rounded-full",
                    eventFormStatusDotClassNameMap[value],
                    size === "sm" && "size-1.75"
                )}
            />
            {status!.label}
        </span>
    )
}
