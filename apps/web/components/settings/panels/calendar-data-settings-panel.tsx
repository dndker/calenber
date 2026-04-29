"use client"

import {
    CalendarCollectionTable,
    type CalendarCollectionTableRow,
} from "@/components/settings/panels/calendar-collection-table"
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
    getCalendarCollectionLabelClassName,
    type CalendarCollectionColor,
} from "@/lib/calendar/collection-color"
import {
    moveCalendarEventFieldSettings,
    setCalendarEventFieldVisibility,
} from "@/lib/calendar/event-field-settings"
import {
    createCalendarEventCollection,
    deleteCalendarEvent,
    deleteCalendarEventCollection,
    updateCalendarEvent,
    updateCalendarEventCollection,
} from "@/lib/calendar/mutations"
import {
    canManageCalendar,
    canViewCalendarSettings,
} from "@/lib/calendar/permissions"
import type {
    CalendarEventCollection,
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
    tone?: "default" | "collection"
    color?: CalendarCollectionColor
    onRemove: () => void
}
type SelectedCollectionLabel = {
    id: string
    label: string
    color: CalendarCollectionColor | undefined
}
const eventStatusLabelMap = Object.fromEntries(
    eventFormStatusItems.map((item) => [item.value, item.label])
) as Record<CalendarEventStatus, string>

const WITHOUT_COLLECTION_FILTER_KEY = "__without_collection__"

function sortCollectionsForSettings(collections: CalendarEventCollection[]) {
    return [...collections].sort((a, b) => {
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

function getResolvedCollectionsForIds({
    collectionIds,
    eventCollectionMap,
}: {
    collectionIds: string[]
    eventCollectionMap: Map<string, CalendarEventCollection>
}) {
    return collectionIds
        .map((collectionId) => eventCollectionMap.get(collectionId))
        .filter((collection): collection is NonNullable<typeof collection> =>
            Boolean(collection)
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
    const eventCollections = useCalendarStore((s) => s.eventCollections)
    const upsertEventCollectionSnapshot = useCalendarStore(
        (s) => s.upsertEventCollectionSnapshot
    )
    const removeEventCollectionSnapshot = useCalendarStore(
        (s) => s.removeEventCollectionSnapshot
    )
    const [events, setEvents] = useState<CalendarEventRecord[]>([])
    const eventsRef = useRef<CalendarEventRecord[]>([])
    const calendarEventsRef = useRef(calendarEvents)
    const [selectedAuthors, setSelectedAuthors] = useState<string[]>([])
    const [selectedCollectionIdsRaw, setSelectedCollectionIdsRaw] = useState<
        string[]
    >([])
    const [selectedStatuses, setSelectedStatuses] = useState<
        CalendarEventStatus[]
    >([])
    const [isLoading, setIsLoading] = useState(true)
    const [newCollectionName, setNewCollectionName] = useState("")
    const [isCreatingCollection, setIsCreatingCollection] = useState(false)
    const [busyCollectionIds, setBusyCollectionIds] = useState<string[]>([])

    const canManageEvents = canManageCalendar(activeCalendarMembership)
    const canViewData = canViewCalendarSettings(activeCalendarMembership)
    const eventCollectionMap = useMemo(
        () =>
            new Map(
                eventCollections.map((collection) => [
                    collection.id,
                    collection,
                ])
            ),
        [eventCollections]
    )

    const selectedCollectionIds = useMemo(
        () =>
            selectedCollectionIdsRaw.filter(
                (collectionId) =>
                    collectionId === WITHOUT_COLLECTION_FILTER_KEY ||
                    eventCollectionMap.has(collectionId)
            ),
        [eventCollectionMap, selectedCollectionIdsRaw]
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
                const nextCollections = getResolvedCollectionsForIds({
                    collectionIds: event.collectionIds,
                    eventCollectionMap,
                })
                const isSameCollections =
                    event.collections.length === nextCollections.length &&
                    event.collections.every(
                        (collection, index) =>
                            collection === nextCollections[index]
                    )

                if (isSameCollections) {
                    return event
                }

                hasChanges = true
                return {
                    ...event,
                    collections: nextCollections,
                }
            })

            return hasChanges ? nextEvents : current
        })
    }, [eventCollectionMap])

    const withBusyCollection = useCallback(
        async <T,>(collectionId: string, task: () => Promise<T>) => {
            setBusyCollectionIds((current) =>
                current.includes(collectionId)
                    ? current
                    : [...current, collectionId]
            )

            try {
                return await task()
            } finally {
                setBusyCollectionIds((current) =>
                    current.filter((id) => id !== collectionId)
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

    const updateEventsCollections = useCallback(
        async (eventIds: string[], nextCollectionId: string | null) => {
            if (!activeCalendarId || !eventIds.length) {
                return
            }

            const previousEvents = eventsRef.current
            const nextCollectionIds = nextCollectionId
                ? [nextCollectionId]
                : []
            const nextResolvedCollections = nextCollectionIds
                .map((id) => eventCollectionMap.get(id))
                .filter((collection): collection is NonNullable<typeof collection> =>
                    Boolean(collection)
                )

            setEvents((current) =>
                current.map((event) =>
                    eventIds.includes(event.id)
                        ? {
                              ...event,
                              collectionIds: nextCollectionIds,
                              collections: nextResolvedCollections,
                          }
                        : event
                )
            )

            try {
                const supabase = createBrowserSupabase()

                const results = await Promise.all(
                    eventIds.map((eventId) =>
                        updateCalendarEvent(supabase, eventId, {
                            collectionIds: nextCollectionIds,
                        })
                    )
                )

                if (results.some((result) => !result.ok)) {
                    throw new Error("Some event collections failed to update.")
                }

                toast.success(
                    nextCollectionId
                        ? "일정 컬렉션이 업데이트되었습니다."
                        : "일정 컬렉션을 제거했습니다."
                )
            } catch (error) {
                console.error(
                    "Failed to update calendar event collections:",
                    error
                )
                setEvents(previousEvents)
                toast.error("일정 컬렉션을 변경하지 못했습니다.")
            }
        },
        [activeCalendarId, eventCollectionMap]
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

    const renameCollection = useCallback(
        async (collectionId: string, nextName: string) => {
            if (!activeCalendarId || !canManageEvents) {
                return false
            }

            return withBusyCollection(collectionId, async () => {
                try {
                    const supabase = createBrowserSupabase()
                    const updatedCollection =
                        await updateCalendarEventCollection(
                            supabase,
                            collectionId,
                            {
                                name: nextName,
                            }
                        )

                    if (!updatedCollection) {
                        throw new Error("Collection rename failed.")
                    }

                    upsertEventCollectionSnapshot(updatedCollection)
                    return true
                } catch (error) {
                    console.error(
                        "Failed to rename calendar collection:",
                        error
                    )
                    toast.error("컬렉션 이름을 변경하지 못했습니다.")
                    return false
                }
            })
        },
        [
            activeCalendarId,
            canManageEvents,
            upsertEventCollectionSnapshot,
            withBusyCollection,
        ]
    )

    const changeCollectionDefaultVisibility = useCallback(
        async (
            collection: CalendarEventCollection,
            visibleByDefault: boolean
        ) => {
            if (!activeCalendarId || !canManageEvents) {
                return
            }

            if (collection.options.visibleByDefault === visibleByDefault) {
                return
            }

            await withBusyCollection(collection.id, async () => {
                try {
                    const supabase = createBrowserSupabase()
                    const updatedCollection =
                        await updateCalendarEventCollection(
                            supabase,
                            collection.id,
                            {
                                options: {
                                    ...collection.options,
                                    visibleByDefault,
                                },
                            }
                        )

                    if (!updatedCollection) {
                        throw new Error("Collection visibility update failed.")
                    }

                    upsertEventCollectionSnapshot(updatedCollection)
                } catch (error) {
                    console.error(
                        "Failed to update calendar collection visibility:",
                        error
                    )
                    toast.error("기본 체크 상태를 변경하지 못했습니다.")
                }
            })
        },
        [
            activeCalendarId,
            canManageEvents,
            upsertEventCollectionSnapshot,
            withBusyCollection,
        ]
    )

    const changeCollectionColor = useCallback(
        async (
            collection: CalendarEventCollection,
            color: CalendarCollectionColor
        ) => {
            if (!activeCalendarId || !canManageEvents) {
                return
            }

            if (collection.options.color === color) {
                return
            }

            await withBusyCollection(collection.id, async () => {
                try {
                    const supabase = createBrowserSupabase()
                    const updatedCollection =
                        await updateCalendarEventCollection(
                            supabase,
                            collection.id,
                            {
                                options: {
                                    ...collection.options,
                                    color,
                                },
                            }
                        )

                    if (!updatedCollection) {
                        throw new Error("Collection color update failed.")
                    }

                    upsertEventCollectionSnapshot(updatedCollection)
                } catch (error) {
                    console.error(
                        "Failed to update calendar collection color:",
                        error
                    )
                    toast.error("컬렉션 색상을 변경하지 못했습니다.")
                }
            })
        },
        [
            activeCalendarId,
            canManageEvents,
            upsertEventCollectionSnapshot,
            withBusyCollection,
        ]
    )

    const createCollection = useCallback(async () => {
        if (
            !activeCalendarId ||
            activeCalendarId === "demo" ||
            !canManageEvents
        ) {
            return
        }

        const trimmedName = newCollectionName.trim()

        if (!trimmedName) {
            return
        }

        const existingCollection = eventCollections.find(
            (collection) =>
                collection.name.trim().toLowerCase() ===
                trimmedName.toLowerCase()
        )

        if (existingCollection) {
            setNewCollectionName("")
            toast.message("이미 같은 이름의 컬렉션이 있습니다.")
            return
        }

        setIsCreatingCollection(true)

        try {
            const supabase = createBrowserSupabase()
            const createdCollection = await createCalendarEventCollection(
                supabase,
                activeCalendarId,
                {
                    name: trimmedName,
                    options: {
                        visibleByDefault: true,
                    },
                }
            )

            if (!createdCollection) {
                throw new Error("Collection create failed.")
            }

            upsertEventCollectionSnapshot(createdCollection)
            setNewCollectionName("")
            toast.success("컬렉션을 추가했습니다.")
        } catch (error) {
            console.error("Failed to create calendar collection:", error)
            toast.error("컬렉션을 추가하지 못했습니다.")
        } finally {
            setIsCreatingCollection(false)
        }
    }, [
        activeCalendarId,
        canManageEvents,
        eventCollections,
        newCollectionName,
        upsertEventCollectionSnapshot,
    ])

    const removeCollection = useCallback(
        async (collection: CalendarEventCollection) => {
            if (!activeCalendarId || !canManageEvents) {
                return
            }

            await withBusyCollection(collection.id, async () => {
                try {
                    const supabase = createBrowserSupabase()
                    const ok = await deleteCalendarEventCollection(
                        supabase,
                        collection.id
                    )

                    if (!ok) {
                        throw new Error("Collection delete failed.")
                    }

                    removeEventCollectionSnapshot(collection.id)
                    toast.success("컬렉션을 삭제했습니다.")
                } catch (error) {
                    console.error(
                        "Failed to delete calendar collection:",
                        error
                    )
                    toast.error("컬렉션을 삭제하지 못했습니다.")
                }
            })
        },
        [
            activeCalendarId,
            canManageEvents,
            removeEventCollectionSnapshot,
            withBusyCollection,
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
    const collectionOptions = useMemo(
        () =>
            sortCollectionsForSettings(eventCollections).map((collection) => ({
                id: collection.id,
                label: collection.name,
                color: collection.options.color,
            })),
        [eventCollections]
    )
    const columns = useMemo(
        () =>
            getCalendarDataColumns({
                canManageEvents,
                collectionOptions,
                onStatusChange: async (eventId, nextStatus) => {
                    await updateEventsStatus([eventId], nextStatus)
                },
                onCollectionChange: async (eventId, nextCollectionId) => {
                    await updateEventsCollections(
                        [eventId],
                        nextCollectionId
                    )
                },
                onDeleteEvent: async (eventId) => {
                    await removeEvents([eventId])
                },
            }),
        [
            canManageEvents,
            collectionOptions,
            removeEvents,
            updateEventsCollections,
            updateEventsStatus,
        ]
    )

    const selectedAuthorSet = useMemo(
        () => new Set(selectedAuthors),
        [selectedAuthors]
    )
    const selectedCollectionSet = useMemo(
        () => new Set(selectedCollectionIds),
        [selectedCollectionIds]
    )
    const selectedStatusSet = useMemo(
        () => new Set(selectedStatuses),
        [selectedStatuses]
    )

    const filteredEvents = useMemo(() => {
        if (
            !selectedAuthors.length &&
            !selectedCollectionIds.length &&
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
                selectedCollectionSet.size > 0 &&
                !event.collectionIds.some((collectionId) =>
                    selectedCollectionSet.has(collectionId)
                ) &&
                !(
                    selectedCollectionSet.has(WITHOUT_COLLECTION_FILTER_KEY) &&
                    event.collectionIds.length === 0
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
        selectedCollectionIds.length,
        selectedCollectionSet,
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
    const selectedCollectionLabels = useMemo(
        () =>
            selectedCollectionIds.flatMap(
                (collectionId): SelectedCollectionLabel[] => {
                    if (collectionId === WITHOUT_COLLECTION_FILTER_KEY) {
                        return [
                            {
                                id: collectionId,
                                label: "컬렉션 없음",
                                color: undefined,
                            },
                        ]
                    }

                    const collection = eventCollectionMap.get(collectionId)

                    return collection
                        ? [
                              {
                                  id: collection.id,
                                  label: collection.name,
                                  color: collection.options.color,
                              },
                          ]
                        : []
                }
            ),
        [eventCollectionMap, selectedCollectionIds]
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
        const collectionBadges = selectedCollectionLabels.map((label) => ({
            key: `collection:${label.id}`,
            label: label.label,
            tone: "collection" as const,
            color: label.color,
            onRemove: () => {
                setSelectedCollectionIdsRaw((current) =>
                    current.filter((item) => item !== label.id)
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

        return [...authorBadges, ...collectionBadges, ...statusBadges]
    }, [selectedAuthorLabels, selectedCollectionLabels, selectedStatuses])
    const activeFilterCount = activeFilterBadges.length
    const clearAllFilters = useCallback(() => {
        setSelectedAuthors([])
        setSelectedCollectionIdsRaw([])
        setSelectedStatuses([])
    }, [])

    const collectionUsageCountMap = useMemo(() => {
        const usageCountMap = new Map<string, number>()

        calendarEvents.forEach((event) => {
            event.collectionIds.forEach((collectionId) => {
                usageCountMap.set(
                    collectionId,
                    (usageCountMap.get(collectionId) ?? 0) + 1
                )
            })
        })

        return usageCountMap
    }, [calendarEvents])

    const collectionRows = useMemo<CalendarCollectionTableRow[]>(() => {
        return sortCollectionsForSettings(eventCollections).map((collection) => ({
            ...collection,
            usageCount:
                collectionUsageCountMap.get(collection.id) ?? 0,
        }))
    }, [collectionUsageCountMap, eventCollections])

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
                        const collectionIds = storedEvent?.collectionIds ?? []
                        const collections = getResolvedCollectionsForIds({
                            collectionIds,
                            eventCollectionMap,
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
                            collectionIds,
                            collections,
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
    }, [activeCalendarId, canManageEvents, canViewData, eventCollectionMap])

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
                                                checked={selectedCollectionIds.includes(
                                                    WITHOUT_COLLECTION_FILTER_KEY
                                                )}
                                                onCheckedChange={(checked) => {
                                                    setSelectedCollectionIdsRaw(
                                                        (current) =>
                                                            checked
                                                                ? Array.from(
                                                                      new Set([
                                                                          ...current,
                                                                          WITHOUT_COLLECTION_FILTER_KEY,
                                                                      ])
                                                                  )
                                                                : current.filter(
                                                                      (item) =>
                                                                          item !==
                                                                          WITHOUT_COLLECTION_FILTER_KEY
                                                                  )
                                                    )
                                                }}
                                            >
                                                컬렉션 없음
                                            </DropdownMenuCheckboxItem>
                                            {collectionOptions.length ? (
                                                collectionOptions.map(
                                                    (option) => (
                                                        <DropdownMenuCheckboxItem
                                                            key={option.id}
                                                            checked={selectedCollectionIds.includes(
                                                                option.id
                                                            )}
                                                            onCheckedChange={(
                                                                checked
                                                            ) => {
                                                                setSelectedCollectionIdsRaw(
                                                                    (
                                                                        current
                                                                    ) =>
                                                                        checked
                                                                            ? Array.from(
                                                                                  new Set(
                                                                                      [
                                                                                          ...current,
                                                                                          option.id,
                                                                                      ]
                                                                                  )
                                                                              )
                                                                            : current.filter(
                                                                                  (
                                                                                      item
                                                                                  ) =>
                                                                                      item !==
                                                                                      option.id
                                                                              )
                                                                )
                                                            }}
                                                        >
                                                            <span
                                                                className={getCalendarCollectionLabelClassName(
                                                                    option.color,
                                                                    "inline-flex h-6 items-center rounded-md px-1.5 leading-[normal]"
                                                                )}
                                                            >
                                                                {option.label}
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
                                                        "collection"
                                                            ? "outline"
                                                            : "secondary"
                                                    }
                                                    className={
                                                        badge.tone ===
                                                        "collection"
                                                            ? getCalendarCollectionLabelClassName(
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
                                                                void updateEventsCollections(
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
                                                        {collectionOptions.length ? (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                {collectionOptions.map(
                                                                    (option) => (
                                                                        <DropdownMenuItem
                                                                            key={
                                                                                option.id
                                                                            }
                                                                            onSelect={() => {
                                                                                void updateEventsCollections(
                                                                                    selectedEvents.map(
                                                                                        (
                                                                                            event
                                                                                        ) =>
                                                                                            event.id
                                                                                    ),
                                                                                    option.id
                                                                                )
                                                                                table.resetRowSelection()
                                                                            }}
                                                                        >
                                                                            <span
                                                                                className={getCalendarCollectionLabelClassName(
                                                                                    option.color,
                                                                                    "inline-flex h-6 items-center rounded-md px-1.5 leading-[normal]"
                                                                                )}
                                                                            >
                                                                                {
                                                                                    option.label
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

                        <CalendarCollectionTable
                            rows={collectionRows}
                            newCollectionName={newCollectionName}
                            canManageEvents={canManageEvents}
                            isCreatingCollection={isCreatingCollection}
                            isDisabled={
                                !activeCalendarId ||
                                activeCalendarId === "demo" ||
                                !canManageEvents
                            }
                            busyCollectionIds={busyCollectionIds}
                            onNewCollectionNameChange={setNewCollectionName}
                            onCreateCollection={() => {
                                void createCollection()
                            }}
                            onRenameCollection={renameCollection}
                            onChangeCollectionColor={(collection, color) => {
                                void changeCollectionColor(collection, color)
                            }}
                            onChangeCollectionDefaultVisibility={(
                                collection,
                                visibleByDefault
                            ) => {
                                void changeCollectionDefaultVisibility(
                                    collection,
                                    visibleByDefault
                                )
                            }}
                            onRemoveCollection={(collection) => {
                                void removeCollection(collection)
                            }}
                        />
                    </Field>
                </FieldGroup>
            </FieldSet>
        </FieldGroup>
    )
}
