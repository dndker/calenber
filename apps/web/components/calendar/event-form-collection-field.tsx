"use client"

import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { GoogleCalendarIcon } from "@/components/icon/google-calendar-icon"
import {
    getCalendarCollectionLabelClassName,
    type CalendarCollectionColor,
} from "@/lib/calendar/collection-color"
import {
    normalizeCollectionName,
    normalizeNames,
} from "@/lib/calendar/event-form-names"
import type { CalendarEventCollection } from "@/store/calendar-store.types"
import type { CalendarSubscriptionCatalogItem } from "@/store/calendar-store.types"
import { FieldError } from "@workspace/ui/components/field"
import { cn } from "@workspace/ui/lib/utils"
import { useMemo } from "react"
import {
    EventChipsCombobox,
    type EventChipsComboboxOption,
} from "./event-chips-combobox"

/** EventFormCollectionOption의 커스텀 메타 (EventChipsComboboxOption의 data 필드에 담김) */
export type EventFormCollectionMeta = {
    /** 구글 캘린더 구독 카탈로그에서 온 항목 */
    isGoogleCalendar?: boolean
    /** 구글 카탈로그 ID (이벤트 저장 시 어느 구글 캘린더에 쓸지 결정) */
    googleCatalogId?: string
    /** 구글 캘린더 ID (API 호출 시 사용) */
    googleCalendarId?: string
    /** 구글 계정 ID */
    googleAccountId?: string
    /** 일반 컬렉션 데이터 */
    collection?: CalendarEventCollection
}

export type EventFormCollectionOption = EventChipsComboboxOption<EventFormCollectionMeta>

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
            data: { collection },
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
                  data: { collection: matched },
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

/**
 * 구글 캘린더 구독 카탈로그를 EventFormCollectionOption 배열로 변환.
 * value는 "__gcal__:<catalogId>" 형태로 일반 컬렉션과 충돌 없이 식별한다.
 */
export const GOOGLE_COLLECTION_OPTION_PREFIX = "__gcal__"

export function makeGoogleCollectionOptionValue(catalogId: string): string {
    return `${GOOGLE_COLLECTION_OPTION_PREFIX}${catalogId}`
}

export function parseGoogleCollectionOptionValue(
    value: string
): string | null {
    if (value.startsWith(GOOGLE_COLLECTION_OPTION_PREFIX)) {
        return value.slice(GOOGLE_COLLECTION_OPTION_PREFIX.length)
    }
    return null
}

export function isGoogleCollectionOptionValue(value: string): boolean {
    return value.startsWith(GOOGLE_COLLECTION_OPTION_PREFIX)
}

export function buildGoogleCalendarCollectionOptions(
    googleCatalogs: CalendarSubscriptionCatalogItem[]
): EventFormCollectionOption[] {
    return googleCatalogs
        .filter((c) => c.sourceType === "google_calendar")
        .map((catalog) => {
            const config = catalog.config as
                | { googleCalendarId?: string; googleAccountId?: string }
                | undefined
            return {
                value: makeGoogleCollectionOptionValue(catalog.id),
                label: catalog.name,
                color: catalog.collectionColor,
                data: {
                    isGoogleCalendar: true,
                    googleCatalogId: catalog.id,
                    googleCalendarId: config?.googleCalendarId,
                    googleAccountId: config?.googleAccountId,
                },
            }
        })
}

function getCollectionChipClassName(color: string | null | undefined) {
    return getCalendarCollectionLabelClassName(
        color,
        "h-6 gap-0 [&_button]:hover:bg-transparent leading-[normal]"
    )
}

function renderCollectionLabelTag(
    option: EventFormCollectionOption,
    className: string
) {
    return (
        <span
            className={getCalendarCollectionLabelClassName(
                option.color,
                className
            )}
        >
            {option.label}
        </span>
    )
}

type EventFormCollectionChipsFieldProps = {
    value: string[]
    onChange: (nextNames: string[]) => void
    eventCollections: CalendarEventCollection[]
    getDraftCollectionColor: (name: string) => CalendarCollectionColor
    /** 이 캘린더에 설치된 구글 캘린더 구독 카탈로그 */
    googleCalendarCatalogs?: CalendarSubscriptionCatalogItem[]
    disabled?: boolean
    invalid?: boolean
    portalContainer?: HTMLElement | null
    /** ComboboxEmpty에 표시 (입력값과 일치하는 항목이 없을 때 안내) */
    emptyText?: string
    errors?: Array<{ message?: string } | undefined>
    listVariant?: "popover" | "inline"
}

/**
 * 컬렉션 칩 선택 필드. 일반 컬렉션과 구글 캘린더 옵션이 하나의 combobox에 표시된다.
 *
 * 선택 규칙:
 * - 일반 컬렉션: 다중 선택 가능
 * - 구글 캘린더: 하나만 선택 가능, 선택 시 일반 컬렉션 비활성화
 * - 일반 컬렉션 선택 시 구글 옵션 비활성화
 * 즉, 내 캘린더 저장과 구글 캘린더 저장 중 하나만 선택 가능.
 */
export function EventFormCollectionChipsField({
    value,
    onChange,
    eventCollections,
    getDraftCollectionColor,
    googleCalendarCatalogs = [],
    disabled = false,
    invalid = false,
    portalContainer,
    emptyText,
    errors,
    listVariant = "popover",
}: EventFormCollectionChipsFieldProps) {
    const t = useDebugTranslations("event.collection")

    const collectionOptions = useMemo(
        () =>
            buildEventFormCollectionComboboxOptions({
                eventCollections,
                selectedCollectionNames: value.filter(
                    (v) => !isGoogleCollectionOptionValue(v)
                ),
                getDraftCollectionColor,
            }),
        [eventCollections, getDraftCollectionColor, value]
    )

    const googleOptions = useMemo(
        () => buildGoogleCalendarCollectionOptions(googleCalendarCatalogs),
        [googleCalendarCatalogs]
    )

    /**
     * 일반 컬렉션 옵션 + 구글 캘린더 옵션을 합친 최종 목록.
     * 구글 옵션은 항상 목록 하단에 표시된다.
     */
    const allOptions = useMemo(
        () => [...collectionOptions, ...googleOptions],
        [collectionOptions, googleOptions]
    )

    const hasGoogleSelected = value.some(isGoogleCollectionOptionValue)
    const hasCollectionSelected = value.some(
        (v) => !isGoogleCollectionOptionValue(v)
    )

    /**
     * 상호 배타 비활성화 Set:
     * - 구글이 선택돼 있으면 일반 컬렉션 모두 비활성
     * - 일반 컬렉션이 선택돼 있으면 구글 옵션 모두 비활성
     */
    const disabledValues = useMemo(() => {
        if (hasGoogleSelected) {
            return new Set(collectionOptions.map((o) => o.value))
        }
        if (hasCollectionSelected) {
            return new Set(googleOptions.map((o) => o.value))
        }
        return undefined
    }, [hasGoogleSelected, hasCollectionSelected, collectionOptions, googleOptions])

    return (
        <div
            className={cn(
                "flex flex-col gap-2",
                listVariant === "inline" && "gap-1"
            )}
        >
            <EventChipsCombobox<EventFormCollectionMeta>
                portalContainer={portalContainer}
                disabled={disabled}
                options={allOptions}
                disabledValues={disabledValues}
                value={normalizeNames(
                    value.filter((v) => !isGoogleCollectionOptionValue(v))
                ).concat(value.filter(isGoogleCollectionOptionValue))}
                emptyText={emptyText ?? t("emptyText")}
                onValueChange={(values) => {
                    const googleValues = values.filter(
                        isGoogleCollectionOptionValue
                    )
                    const collectionValues = normalizeNames(
                        values.filter((v) => !isGoogleCollectionOptionValue(v))
                    )

                    // 구글은 단일 선택: 새로 추가된 구글 값만 유지
                    const prevGoogleValues = value.filter(
                        isGoogleCollectionOptionValue
                    )
                    const nextGoogleValues =
                        googleValues.length > 1
                            ? googleValues.filter(
                                  (v) => !prevGoogleValues.includes(v)
                              )
                            : googleValues

                    onChange([...collectionValues, ...nextGoogleValues])
                }}
                listVariant={listVariant}
                invalid={invalid}
                placeholder={t("searchOrCreate")}
                chipClassName={(option) => getCollectionChipClassName(option.color)}
                renderChipContent={(option) => (
                    <span className="inline-flex h-6.5 items-center gap-1.5 text-sm">
                        {option.label}
                    </span>
                )}
                renderItemContent={(option) => {
                    if (option.data?.isGoogleCalendar) {
                        return (
                            <span className="inline-flex items-center gap-2">
                                {renderCollectionLabelTag(
                                    option,
                                    "inline-flex h-6.5 items-center gap-1.5 rounded-md px-1.5 text-sm leading-[normal]"
                                )}
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                    <span className="size-3.5 shrink-0">
                                        <GoogleCalendarIcon />
                                    </span>
                                    Google Calendar
                                </span>
                            </span>
                        )
                    }
                    return (
                        <span className="inline-flex items-center gap-2">
                            {renderCollectionLabelTag(
                                option,
                                "inline-flex h-6.5 items-center gap-1.5 rounded-md px-1.5 text-sm leading-[normal]"
                            )}
                            {option.isCreate ? t("createNew") : null}
                        </span>
                    )
                }}
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
