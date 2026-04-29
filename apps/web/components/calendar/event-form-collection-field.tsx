"use client"

import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import {
    getCalendarCollectionLabelClassName,
    type CalendarCollectionColor,
} from "@/lib/calendar/collection-color"
import {
    normalizeCollectionName,
    normalizeNames,
} from "@/lib/calendar/event-form-names"
import type { CalendarEventCollection } from "@/store/calendar-store.types"
import { FieldError } from "@workspace/ui/components/field"
import { cn } from "@workspace/ui/lib/utils"
import { useMemo } from "react"
import { EventChipsCombobox } from "./event-chips-combobox"

export type EventFormCollectionOption = {
    value: string
    label: string
    color?: CalendarCollectionColor
    isCreate?: boolean
    data?: CalendarEventCollection
}

/**
 * 캘린더 컬렉션 목록 + 현재 선택 이름으로 EventChipsCombobox용 옵션 배열을 만든다.
 * EventForm의 collectionOptions useMemo와 동일한 규칙.
 */
export function buildEventFormCollectionComboboxOptions({
    eventCollections,
    selectedCollectionNames,
    getDraftCollectionColor,
}: {
    eventCollections: CalendarEventCollection[]
    selectedCollectionNames: string[]
    getDraftCollectionColor: (name: string) => CalendarCollectionColor
}): EventFormCollectionOption[] {
    const fromDirectory: EventFormCollectionOption[] = eventCollections.map(
        (collection) => ({
            value: collection.name,
            label: collection.name,
            color: collection.options.color,
            data: collection,
        })
    )

    const fromSelection: EventFormCollectionOption[] = normalizeNames(
        selectedCollectionNames
    ).map((name) => {
        const matched =
            eventCollections.find(
                (collection) =>
                    normalizeCollectionName(collection.name) ===
                    normalizeCollectionName(name)
            ) ?? null

        return matched
            ? {
                  value: matched.name,
                  label: matched.name,
                  color: matched.options.color,
                  data: matched,
              }
            : {
                  value: name,
                  label: name,
                  color: getDraftCollectionColor(name),
                  isCreate: true,
              }
    })

    const optionMap = new Map<string, EventFormCollectionOption>()

    for (const option of fromDirectory) {
        optionMap.set(option.value, option)
    }

    for (const option of fromSelection) {
        if (!optionMap.has(option.value)) {
            optionMap.set(option.value, option)
        }
    }

    return Array.from(optionMap.values())
}

type EventFormCollectionChipsFieldProps = {
    value: string[]
    onChange: (nextNames: string[]) => void
    eventCollections: CalendarEventCollection[]
    getDraftCollectionColor: (name: string) => CalendarCollectionColor
    disabled?: boolean
    invalid?: boolean
    portalContainer?: HTMLElement | null
    /** ComboboxEmpty에 표시 (입력값과 일치하는 항목이 없을 때 안내) */
    emptyText?: string
    errors?: Array<{ message?: string } | undefined>
    listVariant?: "popover" | "inline"
}

/** EventForm의 컬렉션 칩 입력과 동일한 UI·동작(필터·엔터로 신규 추가). */
export function EventFormCollectionChipsField({
    value,
    onChange,
    eventCollections,
    getDraftCollectionColor,
    disabled = false,
    invalid = false,
    portalContainer,
    emptyText,
    errors,
    listVariant = "popover",
}: EventFormCollectionChipsFieldProps) {
    const t = useDebugTranslations("event.collection")
    const options = useMemo(
        () =>
            buildEventFormCollectionComboboxOptions({
                eventCollections,
                selectedCollectionNames: value,
                getDraftCollectionColor,
            }),
        [eventCollections, getDraftCollectionColor, value]
    )

    return (
        <div
            className={cn(
                "flex flex-col gap-2",
                listVariant === "inline" && "gap-1"
            )}
        >
            <EventChipsCombobox
                portalContainer={portalContainer}
                disabled={disabled}
                options={options}
                value={normalizeNames(value)}
                emptyText={emptyText ?? t("emptyText")}
                onValueChange={(values) => {
                    onChange(normalizeNames(values))
                }}
                listVariant={listVariant}
                invalid={invalid}
                placeholder={t("searchOrCreate")}
                chipClassName={(option) =>
                    getCalendarCollectionLabelClassName(
                        option.color,
                        "h-6 gap-0 [&_button]:hover:bg-transparent leading-[normal]"
                    )
                }
                renderChipContent={(option) => (
                    <span className="inline-flex h-6.5 items-center gap-1.5 text-sm">
                        {option.label}
                    </span>
                )}
                renderItemContent={(option) => (
                    <span className="inline-flex items-center gap-2">
                        <span
                            className={getCalendarCollectionLabelClassName(
                                option.color,
                                "inline-flex h-6.5 items-center gap-1.5 rounded-md px-1.5 text-sm leading-[normal]"
                            )}
                        >
                            {option.label}
                        </span>
                        {option.isCreate ? t("createNew") : null}
                    </span>
                )}
                createOptionFromQuery={(query) =>
                    query
                        ? {
                              value: query,
                              label: query,
                              color: getDraftCollectionColor(query),
                              isCreate: true,
                          }
                        : null
                }
            />
            {errors?.length ? <FieldError errors={errors} /> : null}
        </div>
    )
}
