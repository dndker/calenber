"use client"

import {
    CalendarCategoryTable,
    type CalendarCategoryTableRow,
} from "@/components/settings/panels/calendar-category-table"
import {
    EventStatusItem,
    eventFormStatusItems,
} from "@/components/calendar/event-form-status-field"
import {
    editableStatuses,
    getCalendarDataColumns,
    type CalendarDataRow,
} from "@/components/settings/panels/calendar-data-table-columns"
import { CalendarEventFieldSettingsCard } from "@/components/settings/panels/calendar-event-field-settings-card"
import { DataTable } from "@/components/settings/shared/data-table"
import { useCalendarEventFieldSettings } from "@/hooks/use-calendar-event-field-settings"
import {
    getCalendarCategoryLabelClassName,
    type CalendarCategoryColor,
} from "@/lib/calendar/category-color"
import {
    moveCalendarEventFieldSettings,
    setCalendarEventFieldVisibility,
} from "@/lib/calendar/event-field-settings"
import {
    createCalendarEventCategory,
    deleteCalendarEvent,
    deleteCalendarEventCategory,
    updateCalendarEvent,
    updateCalendarEventCategory,
} from "@/lib/calendar/mutations"
import {
    canManageCalendar,
    canViewCalendarSettings,
} from "@/lib/calendar/permissions"
import type {
    CalendarEventCategory,
    CalendarEventStatus,
} from "@/store/calendar-store.types"
import { useCalendarStore } from "@/store/useCalendarStore"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldSeparator,
    FieldSet,
} from "@workspace/ui/components/field"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
    CalendarRangeIcon,
    CheckCheckIcon,
    CircleXIcon,
    ListFilterIcon,
    ListFilterPlusIcon,
    TagsIcon,
    XIcon,
} from "lucide-react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

type CalendarEventRecord = CalendarDataRow
type FilterBadge = {
    key: string
    label: string
    tone?: "default" | "category"
    color?: CalendarCategoryColor
    onRemove: () => void
}
type SelectedCategoryLabel = {
    id: string
    label: string
    color: CalendarCategoryColor | undefined
}
const eventStatusLabelMap = Object.fromEntries(
    eventFormStatusItems.map((item) => [item.value, item.label])
) as Record<CalendarEventStatus, string>

const UNCATEGORIZED_FILTER_KEY = "__uncategorized__"

function sortCategoriesForSettings(categories: CalendarEventCategory[]) {
    return [...categories].sort((a, b) => {
        const visibilityCompare =
            Number(b.options.visibleByDefault) -
            Number(a.options.visibleByDefault)

        if (visibilityCompare !== 0) {
            return visibilityCompare
        }

        const nameCompare = a.name.localeCompare(b.name)

        if (nameCompare !== 0) {
            return nameCompare
        }

        return a.id.localeCompare(b.id)
    })
}

function getAuthorFilterKey(event: Pick<CalendarEventRecord, "author">) {
    return (
        event.author?.id ??
        event.author?.email ??
        event.author?.name ??
        "unknown-author"
    )
}

function getResolvedCategoriesForIds({
    categoryIds,
    eventCategoryMap,
}: {
    categoryIds: string[]
    eventCategoryMap: Map<string, CalendarEventCategory>
}) {
    return categoryIds
        .map((categoryId) => eventCategoryMap.get(categoryId))
        .filter((category): category is NonNullable<typeof category> =>
            Boolean(category)
        )
}

const CalendarEventFieldSettingsSection = memo(
    function CalendarEventFieldSettingsSection({
        disabled,
    }: {
        disabled: boolean
    }) {
        const { eventFieldSettings, saveEventFieldSettings } =
            useCalendarEventFieldSettings()

        const handleFieldVisibilityChange = useCallback(
            async (
                fieldId: Parameters<typeof setCalendarEventFieldVisibility>[1],
                visible: boolean
            ) => {
                await saveEventFieldSettings(
                    setCalendarEventFieldVisibility(
                        eventFieldSettings,
                        fieldId,
                        visible
                    )
                )
            },
            [eventFieldSettings, saveEventFieldSettings]
        )

        const handleFieldDragEnd = useCallback(
            async (
                activeId: Parameters<typeof moveCalendarEventFieldSettings>[1],
                overId: Parameters<typeof moveCalendarEventFieldSettings>[2]
            ) => {
                if (activeId === overId) {
                    return
                }

                await saveEventFieldSettings(
                    moveCalendarEventFieldSettings(
                        eventFieldSettings,
                        activeId,
                        overId
                    )
                )
            },
            [eventFieldSettings, saveEventFieldSettings]
        )

        return (
            <Field className="gap-4">
                <FieldContent>
                    <FieldLabel>일정 속성 표시</FieldLabel>
                    <FieldDescription>
                        속성 숨김 여부는 캘린더 단위로 일괄 적용됩니다. 순서는
                        일정 폼에서 드래그하면 바로 저장되고, 여기서는 표시
                        여부를 관리합니다.
                    </FieldDescription>
                </FieldContent>

                <CalendarEventFieldSettingsCard
                    settings={eventFieldSettings}
                    disabled={disabled}
                    onVisibilityChange={(fieldId, visible) => {
                        void handleFieldVisibilityChange(fieldId, visible)
                    }}
                    onReorder={(activeId, overId) => {
                        void handleFieldDragEnd(activeId, overId)
                    }}
                />
            </Field>
        )
    }
)

export function CalendarDataSettingsPanel() {
    const activeCalendarId = useCalendarStore(
        (s) => s.activeCalendar?.id ?? null
    )
    const activeCalendarMembership = useCalendarStore(
        (s) => s.activeCalendarMembership
    )
    const calendarEvents = useCalendarStore((s) => s.events)
    const eventCategories = useCalendarStore((s) => s.eventCategories)
    const upsertEventCategorySnapshot = useCalendarStore(
        (s) => s.upsertEventCategorySnapshot
    )
    const removeEventCategorySnapshot = useCalendarStore(
        (s) => s.removeEventCategorySnapshot
    )
    const [events, setEvents] = useState<CalendarEventRecord[]>([])
    const eventsRef = useRef<CalendarEventRecord[]>([])
    const calendarEventsRef = useRef(calendarEvents)
    const [selectedAuthors, setSelectedAuthors] = useState<string[]>([])
    const [selectedCategoryIdsRaw, setSelectedCategoryIdsRaw] = useState<
        string[]
    >([])
    const [selectedStatuses, setSelectedStatuses] = useState<
        CalendarEventStatus[]
    >([])
    const [isLoading, setIsLoading] = useState(true)
    const [newCategoryName, setNewCategoryName] = useState("")
    const [isCreatingCategory, setIsCreatingCategory] = useState(false)
    const [busyCategoryIds, setBusyCategoryIds] = useState<string[]>([])

    const canManageEvents = canManageCalendar(activeCalendarMembership)
    const canViewData = canViewCalendarSettings(activeCalendarMembership)
    const eventCategoryMap = useMemo(
        () =>
            new Map(eventCategories.map((category) => [category.id, category])),
        [eventCategories]
    )

    const selectedCategoryIds = useMemo(
        () =>
            selectedCategoryIdsRaw.filter(
                (categoryId) =>
                    categoryId === UNCATEGORIZED_FILTER_KEY ||
                    eventCategoryMap.has(categoryId)
            ),
        [eventCategoryMap, selectedCategoryIdsRaw]
    )

    useEffect(() => {
        eventsRef.current = events
    }, [events])

    useEffect(() => {
        calendarEventsRef.current = calendarEvents
    }, [calendarEvents])

    useEffect(() => {
        setEvents((current) => {
            let hasChanges = false

            const nextEvents = current.map((event) => {
                const nextCategories = getResolvedCategoriesForIds({
                    categoryIds: event.categoryIds,
                    eventCategoryMap,
                })
                const isSameCategories =
                    event.categories.length === nextCategories.length &&
                    event.categories.every(
                        (category, index) => category === nextCategories[index]
                    )

                if (isSameCategories) {
                    return event
                }

                hasChanges = true
                return {
                    ...event,
                    categories: nextCategories,
                }
            })

            return hasChanges ? nextEvents : current
        })
    }, [eventCategoryMap])

    const withBusyCategory = useCallback(
        async <T,>(categoryId: string, task: () => Promise<T>) => {
            setBusyCategoryIds((current) =>
                current.includes(categoryId)
                    ? current
                    : [...current, categoryId]
            )

            try {
                return await task()
            } finally {
                setBusyCategoryIds((current) =>
                    current.filter((id) => id !== categoryId)
                )
            }
        },
        []
    )

    const updateEventsStatus = useCallback(
        async (eventIds: string[], nextStatus: CalendarEventStatus) => {
            if (!activeCalendarId || !eventIds.length) {
                return
            }

            const previousEvents = eventsRef.current

            setEvents((current) =>
                current.map((event) =>
                    eventIds.includes(event.id)
                        ? { ...event, status: nextStatus }
                        : event
                )
            )

            try {
                const supabase = createBrowserSupabase()

                const results = await Promise.all(
                    eventIds.map((eventId) =>
                        updateCalendarEvent(supabase, eventId, {
                            status: nextStatus,
                        })
                    )
                )

                if (results.some((result) => !result.ok)) {
                    throw new Error("Some event statuses failed to update.")
                }

                toast.success("일정 상태가 업데이트되었습니다.")
            } catch (error) {
                console.error(
                    "Failed to update calendar event statuses:",
                    error
                )
                setEvents(previousEvents)
                toast.error("일정 상태를 변경하지 못했습니다.")
            }
        },
        [activeCalendarId]
    )

    const updateEventsCategory = useCallback(
        async (eventIds: string[], nextCategoryId: string | null) => {
            if (!activeCalendarId || !eventIds.length) {
                return
            }

            const previousEvents = eventsRef.current
            const nextCategoryIds = nextCategoryId ? [nextCategoryId] : []
            const nextCategories = nextCategoryIds
                .map((categoryId) => eventCategoryMap.get(categoryId))
                .filter((category): category is NonNullable<typeof category> =>
                    Boolean(category)
                )

            setEvents((current) =>
                current.map((event) =>
                    eventIds.includes(event.id)
                        ? {
                              ...event,
                              categoryIds: nextCategoryIds,
                              categories: nextCategories,
                          }
                        : event
                )
            )

            try {
                const supabase = createBrowserSupabase()

                const results = await Promise.all(
                    eventIds.map((eventId) =>
                        updateCalendarEvent(supabase, eventId, {
                            categoryIds: nextCategoryIds,
                        })
                    )
                )

                if (results.some((result) => !result.ok)) {
                    throw new Error("Some event categories failed to update.")
                }

                toast.success(
                    nextCategoryId
                        ? "일정 컬렉션이 업데이트되었습니다."
                        : "일정 컬렉션을 제거했습니다."
                )
            } catch (error) {
                console.error(
                    "Failed to update calendar event categories:",
                    error
                )
                setEvents(previousEvents)
                toast.error("일정 컬렉션을 변경하지 못했습니다.")
            }
        },
        [activeCalendarId, eventCategoryMap]
    )

    const removeEvents = useCallback(
        async (eventIds: string[]) => {
            if (!activeCalendarId || !eventIds.length) {
                return
            }

            const previousEvents = eventsRef.current

            setEvents((current) =>
                current.filter((event) => !eventIds.includes(event.id))
            )

            try {
                const supabase = createBrowserSupabase()

                const results = await Promise.all(
                    eventIds.map((eventId) =>
                        deleteCalendarEvent(supabase, eventId)
                    )
                )

                if (results.some((result) => !result)) {
                    throw new Error("Some events failed to delete.")
                }

                toast.success("일정을 삭제했습니다.")
            } catch (error) {
                console.error("Failed to delete calendar events:", error)
                setEvents(previousEvents)
                toast.error("일정을 삭제하지 못했습니다.")
            }
        },
        [activeCalendarId]
    )

    const renameCategory = useCallback(
        async (categoryId: string, nextName: string) => {
            if (!activeCalendarId || !canManageEvents) {
                return false
            }

            return withBusyCategory(categoryId, async () => {
                try {
                    const supabase = createBrowserSupabase()
                    const updatedCategory = await updateCalendarEventCategory(
                        supabase,
                        categoryId,
                        {
                            name: nextName,
                        }
                    )

                    if (!updatedCategory) {
                        throw new Error("Category rename failed.")
                    }

                    upsertEventCategorySnapshot(updatedCategory)
                    return true
                } catch (error) {
                    console.error("Failed to rename calendar category:", error)
                    toast.error("컬렉션 이름을 변경하지 못했습니다.")
                    return false
                }
            })
        },
        [
            activeCalendarId,
            canManageEvents,
            upsertEventCategorySnapshot,
            withBusyCategory,
        ]
    )

    const changeCategoryDefaultVisibility = useCallback(
        async (category: CalendarEventCategory, visibleByDefault: boolean) => {
            if (!activeCalendarId || !canManageEvents) {
                return
            }

            if (category.options.visibleByDefault === visibleByDefault) {
                return
            }

            await withBusyCategory(category.id, async () => {
                try {
                    const supabase = createBrowserSupabase()
                    const updatedCategory = await updateCalendarEventCategory(
                        supabase,
                        category.id,
                        {
                            options: {
                                ...category.options,
                                visibleByDefault,
                            },
                        }
                    )

                    if (!updatedCategory) {
                        throw new Error("Category visibility update failed.")
                    }

                    upsertEventCategorySnapshot(updatedCategory)
                } catch (error) {
                    console.error(
                        "Failed to update calendar category visibility:",
                        error
                    )
                    toast.error("기본 체크 상태를 변경하지 못했습니다.")
                }
            })
        },
        [
            activeCalendarId,
            canManageEvents,
            upsertEventCategorySnapshot,
            withBusyCategory,
        ]
    )

    const changeCategoryColor = useCallback(
        async (
            category: CalendarEventCategory,
            color: CalendarCategoryColor
        ) => {
            if (!activeCalendarId || !canManageEvents) {
                return
            }

            if (category.options.color === color) {
                return
            }

            await withBusyCategory(category.id, async () => {
                try {
                    const supabase = createBrowserSupabase()
                    const updatedCategory = await updateCalendarEventCategory(
                        supabase,
                        category.id,
                        {
                            options: {
                                ...category.options,
                                color,
                            },
                        }
                    )

                    if (!updatedCategory) {
                        throw new Error("Category color update failed.")
                    }

                    upsertEventCategorySnapshot(updatedCategory)
                } catch (error) {
                    console.error(
                        "Failed to update calendar category color:",
                        error
                    )
                    toast.error("컬렉션 색상을 변경하지 못했습니다.")
                }
            })
        },
        [
            activeCalendarId,
            canManageEvents,
            upsertEventCategorySnapshot,
            withBusyCategory,
        ]
    )

    const createCategory = useCallback(async () => {
        if (
            !activeCalendarId ||
            activeCalendarId === "demo" ||
            !canManageEvents
        ) {
            return
        }

        const trimmedName = newCategoryName.trim()

        if (!trimmedName) {
            return
        }

        const existingCategory = eventCategories.find(
            (category) =>
                category.name.trim().toLowerCase() === trimmedName.toLowerCase()
        )

        if (existingCategory) {
            setNewCategoryName("")
            toast.message("이미 같은 이름의 컬렉션이 있습니다.")
            return
        }

        setIsCreatingCategory(true)

        try {
            const supabase = createBrowserSupabase()
            const createdCategory = await createCalendarEventCategory(
                supabase,
                activeCalendarId,
                {
                    name: trimmedName,
                    options: {
                        visibleByDefault: true,
                    },
                }
            )

            if (!createdCategory) {
                throw new Error("Category create failed.")
            }

            upsertEventCategorySnapshot(createdCategory)
            setNewCategoryName("")
            toast.success("컬렉션을 추가했습니다.")
        } catch (error) {
            console.error("Failed to create calendar category:", error)
            toast.error("컬렉션을 추가하지 못했습니다.")
        } finally {
            setIsCreatingCategory(false)
        }
    }, [
        activeCalendarId,
        canManageEvents,
        eventCategories,
        newCategoryName,
        upsertEventCategorySnapshot,
    ])

    const removeCategory = useCallback(
        async (category: CalendarEventCategory) => {
            if (!activeCalendarId || !canManageEvents) {
                return
            }

            await withBusyCategory(category.id, async () => {
                try {
                    const supabase = createBrowserSupabase()
                    const ok = await deleteCalendarEventCategory(
                        supabase,
                        category.id
                    )

                    if (!ok) {
                        throw new Error("Category delete failed.")
                    }

                    removeEventCategorySnapshot(category.id)
                    toast.success("컬렉션을 삭제했습니다.")
                } catch (error) {
                    console.error("Failed to delete calendar category:", error)
                    toast.error("컬렉션을 삭제하지 못했습니다.")
                }
            })
        },
        [
            activeCalendarId,
            canManageEvents,
            removeEventCategorySnapshot,
            withBusyCategory,
        ]
    )

    const authorOptions = useMemo(() => {
        const authorMap = new Map<
            string,
            { key: string; label: string; email: string | null }
        >()

        events.forEach((event) => {
            const key =
                event.author?.id ??
                event.author?.email ??
                event.author?.name ??
                "unknown-author"

            if (!authorMap.has(key)) {
                authorMap.set(key, {
                    key,
                    label: event.author?.name ?? "알 수 없는 사용자",
                    email: event.author?.email ?? null,
                })
            }
        })

        return Array.from(authorMap.values())
    }, [events])
    const categoryOptions = useMemo(
        () =>
            sortCategoriesForSettings(eventCategories).map((category) => ({
                id: category.id,
                label: category.name,
                color: category.options.color,
            })),
        [eventCategories]
    )
    const columns = useMemo(
        () =>
            getCalendarDataColumns({
                canManageEvents,
                categoryOptions,
                onStatusChange: async (eventId, nextStatus) => {
                    await updateEventsStatus([eventId], nextStatus)
                },
                onCategoryChange: async (eventId, nextCategoryId) => {
                    await updateEventsCategory([eventId], nextCategoryId)
                },
                onDeleteEvent: async (eventId) => {
                    await removeEvents([eventId])
                },
            }),
        [
            canManageEvents,
            categoryOptions,
            removeEvents,
            updateEventsCategory,
            updateEventsStatus,
        ]
    )

    const selectedAuthorSet = useMemo(
        () => new Set(selectedAuthors),
        [selectedAuthors]
    )
    const selectedCategorySet = useMemo(
        () => new Set(selectedCategoryIds),
        [selectedCategoryIds]
    )
    const selectedStatusSet = useMemo(
        () => new Set(selectedStatuses),
        [selectedStatuses]
    )

    const filteredEvents = useMemo(() => {
        if (
            !selectedAuthors.length &&
            !selectedCategoryIds.length &&
            !selectedStatuses.length
        ) {
            return events
        }

        return events.filter((event) => {
            if (
                selectedAuthorSet.size > 0 &&
                !selectedAuthorSet.has(getAuthorFilterKey(event))
            ) {
                return false
            }

            if (
                selectedCategorySet.size > 0 &&
                !event.categoryIds.some((categoryId) =>
                    selectedCategorySet.has(categoryId)
                ) &&
                !(
                    selectedCategorySet.has(UNCATEGORIZED_FILTER_KEY) &&
                    event.categoryIds.length === 0
                )
            ) {
                return false
            }

            if (
                selectedStatusSet.size > 0 &&
                !selectedStatusSet.has(event.status)
            ) {
                return false
            }

            return true
        })
    }, [
        events,
        selectedAuthors.length,
        selectedAuthorSet,
        selectedCategoryIds.length,
        selectedCategorySet,
        selectedStatuses.length,
        selectedStatusSet,
    ])

    const selectedAuthorLabels = useMemo(
        () =>
            authorOptions.filter((author) =>
                selectedAuthors.includes(author.key)
            ),
        [authorOptions, selectedAuthors]
    )
    const selectedCategoryLabels = useMemo(
        () =>
            selectedCategoryIds.flatMap(
                (categoryId): SelectedCategoryLabel[] => {
                    if (categoryId === UNCATEGORIZED_FILTER_KEY) {
                        return [
                            {
                                id: categoryId,
                                label: "컬렉션 없음",
                                color: undefined,
                            },
                        ]
                    }

                    const category = eventCategoryMap.get(categoryId)

                    return category
                        ? [
                              {
                                  id: category.id,
                                  label: category.name,
                                  color: category.options.color,
                              },
                          ]
                        : []
                }
            ),
        [eventCategoryMap, selectedCategoryIds]
    )
    const activeFilterBadges = useMemo<FilterBadge[]>(() => {
        const authorBadges = selectedAuthorLabels.map((author) => ({
            key: `author:${author.key}`,
            label: author.label,
            onRemove: () => {
                setSelectedAuthors((current) =>
                    current.filter((item) => item !== author.key)
                )
            },
        }))
        const categoryBadges = selectedCategoryLabels.map((category) => ({
            key: `category:${category.id}`,
            label: category.label,
            tone: "category" as const,
            color: category.color,
            onRemove: () => {
                setSelectedCategoryIdsRaw((current) =>
                    current.filter((item) => item !== category.id)
                )
            },
        }))
        const statusBadges = selectedStatuses.map((status) => ({
            key: `status:${status}`,
            label: eventStatusLabelMap[status],
            onRemove: () => {
                setSelectedStatuses((current) =>
                    current.filter((item) => item !== status)
                )
            },
        }))

        return [...authorBadges, ...categoryBadges, ...statusBadges]
    }, [selectedAuthorLabels, selectedCategoryLabels, selectedStatuses])
    const activeFilterCount = activeFilterBadges.length
    const clearAllFilters = useCallback(() => {
        setSelectedAuthors([])
        setSelectedCategoryIdsRaw([])
        setSelectedStatuses([])
    }, [])

    const categoryUsageCountMap = useMemo(() => {
        const usageCountMap = new Map<string, number>()

        calendarEvents.forEach((event) => {
            event.categoryIds.forEach((categoryId) => {
                usageCountMap.set(
                    categoryId,
                    (usageCountMap.get(categoryId) ?? 0) + 1
                )
            })
        })

        return usageCountMap
    }, [calendarEvents])

    const categoryRows = useMemo<CalendarCategoryTableRow[]>(() => {
        return sortCategoriesForSettings(eventCategories).map((category) => ({
            ...category,
            usageCount: categoryUsageCountMap.get(category.id) ?? 0,
        }))
    }, [categoryUsageCountMap, eventCategories])

    useEffect(() => {
        if (!canViewData) {
            setEvents([])
            setIsLoading(false)
            return
        }

        if (!activeCalendarId || activeCalendarId === "demo") {
            setEvents([])
            setIsLoading(false)
            return
        }

        let isCancelled = false

        const loadEvents = async () => {
            setIsLoading(true)

            try {
                const supabase = createBrowserSupabase()
                const { data, error } = await supabase.rpc(
                    "get_calendar_events_with_authors",
                    {
                        target_calendar_id: activeCalendarId,
                    }
                )

                if (error) {
                    throw error
                }

                if (isCancelled) {
                    return
                }

                const rows =
                    (data as
                        | {
                              id: string
                              title: string | null
                              start_at: string | null
                              end_at: string | null
                              status: CalendarEventStatus | null
                              creator_name: string | null
                              creator_email: string | null
                              creator_avatar_url: string | null
                          }[]
                        | null) ?? []
                const eventLookup = new Map(
                    calendarEventsRef.current.map((event) => [event.id, event])
                )

                setEvents(
                    rows.map((event) => {
                        const storedEvent = eventLookup.get(event.id)
                        const categoryIds = storedEvent?.categoryIds ?? []
                        const categories = getResolvedCategoriesForIds({
                            categoryIds,
                            eventCategoryMap,
                        })

                        return {
                            id: event.id,
                            title: event.title ?? "",
                            start: event.start_at
                                ? new Date(event.start_at).valueOf()
                                : Date.now(),
                            end: event.end_at
                                ? new Date(event.end_at).valueOf()
                                : Date.now(),
                            allDay: storedEvent?.allDay ?? false,
                            timezone:
                                storedEvent?.timezone ?? "Asia/Seoul",
                            status: event.status ?? "scheduled",
                            author:
                                event.creator_name ||
                                event.creator_email ||
                                event.creator_avatar_url
                                    ? {
                                          id: null,
                                          name: event.creator_name,
                                          email: event.creator_email,
                                          avatarUrl: event.creator_avatar_url,
                                      }
                                    : null,
                            categoryIds,
                            categories,
                            recurrence: storedEvent?.recurrence,
                            recurrenceInstance:
                                storedEvent?.recurrenceInstance,
                            canManage: canManageEvents,
                        }
                    })
                )
            } catch (error) {
                console.error("Failed to load calendar events:", error)
                if (!isCancelled) {
                    setEvents([])
                }
            } finally {
                if (!isCancelled) {
                    setIsLoading(false)
                }
            }
        }

        void loadEvents()

        return () => {
            isCancelled = true
        }
    }, [activeCalendarId, canManageEvents, canViewData, eventCategoryMap])

    if (!activeCalendarId) {
        return (
            <div className="text-sm text-muted-foreground">
                캘린더를 선택하면 데이터 설정을 확인할 수 있습니다.
            </div>
        )
    }

    if (!canViewData) {
        return (
            <div className="text-sm text-muted-foreground">
                이 캘린더의 데이터 설정은 멤버만 조회할 수 있습니다.
            </div>
        )
    }

    return (
        <FieldGroup>
            <FieldSet>
                <FieldGroup>
                    <Field className="gap-4">
                        <FieldContent>
                            <FieldLabel>일정 목록</FieldLabel>
                            <FieldDescription>
                                현재 이 캘린더에 등록된 모든 일정과 상태를
                                관리합니다.
                            </FieldDescription>
                        </FieldContent>

                        {isLoading ? (
                            <div className="space-y-2 rounded-xl border p-3">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-14 w-full" />
                                <Skeleton className="h-14 w-full" />
                            </div>
                        ) : (
                            <DataTable
                                columns={columns}
                                data={filteredEvents}
                                getRowId={(row) => row.id}
                                emptyMessage="등록된 일정이 없습니다."
                                filterColumnId="event"
                                filterPlaceholder="제목, 작성자 이름 또는 이메일로 검색"
                                enableRowSelection={(row) =>
                                    canManageEvents && row.original.canManage
                                }
                                toolbarActions={() => (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="leading-[normal]"
                                            >
                                                {activeFilterCount > 0 ? (
                                                    <ListFilterIcon />
                                                ) : (
                                                    <ListFilterPlusIcon />
                                                )}
                                                필터
                                                {activeFilterCount > 0
                                                    ? ` ${activeFilterCount}`
                                                    : ""}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            align="end"
                                            className="w-55"
                                        >
                                            {activeFilterCount > 0 ? (
                                                <>
                                                    <DropdownMenuItem
                                                        onSelect={() => {
                                                            clearAllFilters()
                                                        }}
                                                    >
                                                        <CircleXIcon />
                                                        필터 초기화
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                </>
                                            ) : null}
                                            <DropdownMenuLabel>
                                                작성자
                                            </DropdownMenuLabel>
                                            {authorOptions.length ? (
                                                authorOptions.map((author) => (
                                                    <DropdownMenuCheckboxItem
                                                        key={author.key}
                                                        checked={selectedAuthors.includes(
                                                            author.key
                                                        )}
                                                        onCheckedChange={(
                                                            checked
                                                        ) => {
                                                            setSelectedAuthors(
                                                                (current) =>
                                                                    checked
                                                                        ? Array.from(
                                                                              new Set(
                                                                                  [
                                                                                      ...current,
                                                                                      author.key,
                                                                                  ]
                                                                              )
                                                                          )
                                                                        : current.filter(
                                                                              (
                                                                                  item
                                                                              ) =>
                                                                                  item !==
                                                                                  author.key
                                                                          )
                                                            )
                                                        }}
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="truncate">
                                                                {author.label}
                                                            </div>
                                                            {author.email ? (
                                                                <div className="truncate text-xs text-muted-foreground">
                                                                    {
                                                                        author.email
                                                                    }
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </DropdownMenuCheckboxItem>
                                                ))
                                            ) : (
                                                <DropdownMenuItem disabled>
                                                    작성자 없음
                                                </DropdownMenuItem>
                                            )}

                                            <DropdownMenuSeparator />
                                            <DropdownMenuLabel>
                                                컬렉션
                                            </DropdownMenuLabel>
                                            <DropdownMenuCheckboxItem
                                                checked={selectedCategoryIds.includes(
                                                    UNCATEGORIZED_FILTER_KEY
                                                )}
                                                onCheckedChange={(checked) => {
                                                    setSelectedCategoryIdsRaw(
                                                        (current) =>
                                                            checked
                                                                ? Array.from(
                                                                      new Set([
                                                                          ...current,
                                                                          UNCATEGORIZED_FILTER_KEY,
                                                                      ])
                                                                  )
                                                                : current.filter(
                                                                      (item) =>
                                                                          item !==
                                                                          UNCATEGORIZED_FILTER_KEY
                                                                  )
                                                    )
                                                }}
                                            >
                                                컬렉션 없음
                                            </DropdownMenuCheckboxItem>
                                            {categoryOptions.length ? (
                                                categoryOptions.map(
                                                    (category) => (
                                                        <DropdownMenuCheckboxItem
                                                            key={category.id}
                                                            checked={selectedCategoryIds.includes(
                                                                category.id
                                                            )}
                                                            onCheckedChange={(
                                                                checked
                                                            ) => {
                                                                setSelectedCategoryIdsRaw(
                                                                    (
                                                                        current
                                                                    ) =>
                                                                        checked
                                                                            ? Array.from(
                                                                                  new Set(
                                                                                      [
                                                                                          ...current,
                                                                                          category.id,
                                                                                      ]
                                                                                  )
                                                                              )
                                                                            : current.filter(
                                                                                  (
                                                                                      item
                                                                                  ) =>
                                                                                      item !==
                                                                                      category.id
                                                                              )
                                                                )
                                                            }}
                                                        >
                                                            <span
                                                                className={getCalendarCategoryLabelClassName(
                                                                    category.color,
                                                                    "inline-flex h-6 items-center rounded-md px-1.5 leading-[normal]"
                                                                )}
                                                            >
                                                                {category.label}
                                                            </span>
                                                        </DropdownMenuCheckboxItem>
                                                    )
                                                )
                                            ) : (
                                                <DropdownMenuItem disabled>
                                                    컬렉션 없음
                                                </DropdownMenuItem>
                                            )}

                                            <DropdownMenuSeparator />
                                            <DropdownMenuLabel>
                                                상태
                                            </DropdownMenuLabel>
                                            {editableStatuses.map((status) => (
                                                <DropdownMenuCheckboxItem
                                                    key={status}
                                                    checked={selectedStatuses.includes(
                                                        status
                                                    )}
                                                    onCheckedChange={(
                                                        checked
                                                    ) => {
                                                        setSelectedStatuses(
                                                            (current) =>
                                                                checked
                                                                    ? Array.from(
                                                                          new Set(
                                                                              [
                                                                                  ...current,
                                                                                  status,
                                                                              ]
                                                                          )
                                                                      )
                                                                    : current.filter(
                                                                          (
                                                                              item
                                                                          ) =>
                                                                              item !==
                                                                              status
                                                                      )
                                                        )
                                                    }}
                                                >
                                                    <EventStatusItem
                                                        value={status}
                                                        size="sm"
                                                    />
                                                </DropdownMenuCheckboxItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                                toolbarContent={
                                    activeFilterBadges.length > 0 ? (
                                        <div className="flex flex-wrap items-center gap-2">
                                            {activeFilterBadges.map((badge) => (
                                                <Badge
                                                    key={badge.key}
                                                    variant={
                                                        badge.tone ===
                                                        "category"
                                                            ? "outline"
                                                            : "secondary"
                                                    }
                                                    className={
                                                        badge.tone ===
                                                        "category"
                                                            ? getCalendarCategoryLabelClassName(
                                                                  badge.color,
                                                                  "h-6 gap-px border-transparent"
                                                              )
                                                            : "h-6 gap-px"
                                                    }
                                                >
                                                    {badge.label}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        type="button"
                                                        className="size-3 p-0 text-muted-foreground/70 hover:text-primary"
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            badge.onRemove()
                                                        }}
                                                    >
                                                        <XIcon className="-mr-px size-3.25" />
                                                    </Button>
                                                </Badge>
                                            ))}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                type="button"
                                                onClick={clearAllFilters}
                                            >
                                                <CircleXIcon />
                                                필터 초기화
                                            </Button>
                                        </div>
                                    ) : null
                                }
                                bulkActions={(table) => {
                                    const selectedEvents = table
                                        .getFilteredSelectedRowModel()
                                        .rows.map((row) => row.original)
                                        .filter((event) => event.canManage)

                                    if (
                                        !canManageEvents ||
                                        !selectedEvents.length
                                    ) {
                                        return null
                                    }

                                    return (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                >
                                                    <CheckCheckIcon />
                                                    선택 항목 수정 (
                                                    {selectedEvents.length})
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                                align="end"
                                                className="w-56"
                                            >
                                                <DropdownMenuLabel>
                                                    선택한 일정 일괄 수정
                                                </DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuSub>
                                                    <DropdownMenuSubTrigger>
                                                        <CalendarRangeIcon />
                                                        상태 변경
                                                    </DropdownMenuSubTrigger>
                                                    <DropdownMenuSubContent className="w-44">
                                                        {editableStatuses.map(
                                                            (status) => (
                                                                <DropdownMenuItem
                                                                    key={status}
                                                                    onSelect={() => {
                                                                        void updateEventsStatus(
                                                                            selectedEvents.map(
                                                                                (
                                                                                    event
                                                                                ) =>
                                                                                    event.id
                                                                            ),
                                                                            status
                                                                        )
                                                                        table.resetRowSelection()
                                                                    }}
                                                                >
                                                                    <EventStatusItem
                                                                        value={
                                                                            status
                                                                        }
                                                                        size="sm"
                                                                    />
                                                                </DropdownMenuItem>
                                                            )
                                                        )}
                                                    </DropdownMenuSubContent>
                                                </DropdownMenuSub>
                                                <DropdownMenuSub>
                                                    <DropdownMenuSubTrigger>
                                                        <TagsIcon />
                                                        컬렉션 변경
                                                    </DropdownMenuSubTrigger>
                                                    <DropdownMenuSubContent className="w-52">
                                                        <DropdownMenuItem
                                                            onSelect={() => {
                                                                void updateEventsCategory(
                                                                    selectedEvents.map(
                                                                        (
                                                                            event
                                                                        ) =>
                                                                            event.id
                                                                    ),
                                                                    null
                                                                )
                                                                table.resetRowSelection()
                                                            }}
                                                        >
                                                            컬렉션 없음
                                                        </DropdownMenuItem>
                                                        {categoryOptions.length ? (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                {categoryOptions.map(
                                                                    (
                                                                        category
                                                                    ) => (
                                                                        <DropdownMenuItem
                                                                            key={
                                                                                category.id
                                                                            }
                                                                            onSelect={() => {
                                                                                void updateEventsCategory(
                                                                                    selectedEvents.map(
                                                                                        (
                                                                                            event
                                                                                        ) =>
                                                                                            event.id
                                                                                    ),
                                                                                    category.id
                                                                                )
                                                                                table.resetRowSelection()
                                                                            }}
                                                                        >
                                                                            <span
                                                                                className={getCalendarCategoryLabelClassName(
                                                                                    category.color,
                                                                                    "inline-flex h-6 items-center rounded-md px-1.5 leading-[normal]"
                                                                                )}
                                                                            >
                                                                                {
                                                                                    category.label
                                                                                }
                                                                            </span>
                                                                        </DropdownMenuItem>
                                                                    )
                                                                )}
                                                            </>
                                                        ) : null}
                                                    </DropdownMenuSubContent>
                                                </DropdownMenuSub>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )
                                }}
                            />
                        )}
                    </Field>

                    <FieldSeparator />

                    <CalendarEventFieldSettingsSection
                        disabled={
                            !activeCalendarId ||
                            activeCalendarId === "demo" ||
                            !canManageEvents
                        }
                    />

                    <FieldSeparator />

                    <Field className="gap-4">
                        <FieldContent>
                            <FieldLabel>컬렉션 목록</FieldLabel>
                            <FieldDescription>
                                모든 컬렉션을 한 화면에서 추가하고, 이름을
                                바로 수정하고, 사이드바 기본 체크 상태를 설정할
                                수 있습니다.
                            </FieldDescription>
                        </FieldContent>

                        <CalendarCategoryTable
                            rows={categoryRows}
                            newCategoryName={newCategoryName}
                            canManageEvents={canManageEvents}
                            isCreatingCategory={isCreatingCategory}
                            isDisabled={
                                !activeCalendarId ||
                                activeCalendarId === "demo" ||
                                !canManageEvents
                            }
                            busyCategoryIds={busyCategoryIds}
                            onNewCategoryNameChange={setNewCategoryName}
                            onCreateCategory={() => {
                                void createCategory()
                            }}
                            onRenameCategory={renameCategory}
                            onChangeCategoryColor={(category, color) => {
                                void changeCategoryColor(category, color)
                            }}
                            onChangeCategoryDefaultVisibility={(
                                category,
                                visibleByDefault
                            ) => {
                                void changeCategoryDefaultVisibility(
                                    category,
                                    visibleByDefault
                                )
                            }}
                            onRemoveCategory={(category) => {
                                void removeCategory(category)
                            }}
                        />
                    </Field>
                </FieldGroup>
            </FieldSet>
        </FieldGroup>
    )
}
