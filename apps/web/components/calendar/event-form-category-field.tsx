"use client"

import {
    getCalendarCategoryLabelClassName,
    type CalendarCategoryColor,
} from "@/lib/calendar/category-color"
import {
    normalizeCategoryName,
    normalizeNames,
} from "@/lib/calendar/event-form-names"
import type { CalendarEventCategory } from "@/store/calendar-store.types"
import { FieldError } from "@workspace/ui/components/field"
import { cn } from "@workspace/ui/lib/utils"
import { useMemo } from "react"
import { EventChipsCombobox } from "./event-chips-combobox"

export type EventFormCategoryOption = {
    value: string
    label: string
    color?: CalendarCategoryColor
    isCreate?: boolean
    data?: CalendarEventCategory
}

/**
 * 캘린더 카테고리 목록 + 현재 선택 이름으로 EventChipsCombobox용 옵션 배열을 만든다.
 * EventForm의 categoryOptions useMemo와 동일한 규칙.
 */
export function buildEventFormCategoryComboboxOptions({
    eventCategories,
    selectedCategoryNames,
    getDraftCategoryColor,
}: {
    eventCategories: CalendarEventCategory[]
    selectedCategoryNames: string[]
    getDraftCategoryColor: (name: string) => CalendarCategoryColor
}): EventFormCategoryOption[] {
    const categoryItems: EventFormCategoryOption[] = eventCategories.map(
        (category) => ({
            value: category.name,
            label: category.name,
            color: category.options.color,
            data: category,
        })
    )

    const selectedCategories: EventFormCategoryOption[] = normalizeNames(
        selectedCategoryNames
    ).map((categoryName) => {
        const matchedCategory =
            eventCategories.find(
                (category) =>
                    normalizeCategoryName(category.name) ===
                    normalizeCategoryName(categoryName)
            ) ?? null

        return matchedCategory
            ? {
                  value: matchedCategory.name,
                  label: matchedCategory.name,
                  color: matchedCategory.options.color,
                  data: matchedCategory,
              }
            : {
                  value: categoryName,
                  label: categoryName,
                  color: getDraftCategoryColor(categoryName),
                  isCreate: true,
              }
    })

    const optionMap = new Map<string, EventFormCategoryOption>()

    for (const option of categoryItems) {
        optionMap.set(option.value, option)
    }

    for (const option of selectedCategories) {
        if (!optionMap.has(option.value)) {
            optionMap.set(option.value, option)
        }
    }

    return Array.from(optionMap.values())
}

type EventFormCategoryChipsFieldProps = {
    value: string[]
    onChange: (nextNames: string[]) => void
    eventCategories: CalendarEventCategory[]
    getDraftCategoryColor: (name: string) => CalendarCategoryColor
    disabled?: boolean
    invalid?: boolean
    portalContainer?: HTMLElement | null
    /** ComboboxEmpty에 표시 (입력값과 일치하는 항목이 없을 때 안내) */
    emptyText?: string
    errors?: Array<{ message?: string } | undefined>
    listVariant?: "popover" | "inline"
}

/** EventForm의 카테고리 칩 입력과 동일한 UI·동작(필터·엔터로 신규 추가). */
export function EventFormCategoryChipsField({
    value,
    onChange,
    eventCategories,
    getDraftCategoryColor,
    disabled = false,
    invalid = false,
    portalContainer,
    emptyText = "컬렉션을 입력해 생성할 수 있습니다.",
    errors,
    listVariant = "popover",
}: EventFormCategoryChipsFieldProps) {
    const options = useMemo(
        () =>
            buildEventFormCategoryComboboxOptions({
                eventCategories,
                selectedCategoryNames: value,
                getDraftCategoryColor,
            }),
        [eventCategories, getDraftCategoryColor, value]
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
                emptyText={emptyText}
                onValueChange={(values) => {
                    onChange(normalizeNames(values))
                }}
                listVariant={listVariant}
                invalid={invalid}
                placeholder="검색 또는 생성"
                chipClassName={(category) =>
                    getCalendarCategoryLabelClassName(
                        category.color,
                        "h-6 gap-0 [&_button]:hover:bg-transparent leading-[normal]"
                    )
                }
                renderChipContent={(category) => (
                    <span className="inline-flex h-6.5 items-center gap-1.5 text-sm">
                        {category.label}
                    </span>
                )}
                renderItemContent={(category) => (
                    <span className="inline-flex items-center gap-2">
                        <span
                            className={getCalendarCategoryLabelClassName(
                                category.color,
                                "inline-flex h-6.5 items-center gap-1.5 rounded-md px-1.5 text-sm leading-[normal]"
                            )}
                        >
                            {category.label}
                        </span>
                        {category.isCreate ? "새 컬렉션 생성" : null}
                    </span>
                )}
                createOptionFromQuery={(query) =>
                    query
                        ? {
                              value: query,
                              label: query,
                              color: getDraftCategoryColor(query),
                              isCreate: true,
                          }
                        : null
                }
            />
            {errors?.length ? <FieldError errors={errors} /> : null}
        </div>
    )
}
