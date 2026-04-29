"use client"

import {
    CalendarCollectionTable,
    type CalendarCollectionTableRow,
} from "@/components/settings/panels/calendar-collection-table"
import {
    EventStatusItem,
    useEventFormStatusItems,
} from "@/components/calendar/event-form-status-field"
import {
    editableStatuses,
    getCalendarDataColumns,
    type CalendarDataRow,
} from "@/components/settings/panels/calendar-data-table-columns"
import { CalendarEventFieldSettingsCard } from "@/components/settings/panels/calendar-event-field-settings-card"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
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
import { useLocale } from "next-intl"
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
        const t = useDebugTranslations("settings.calendarData")
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
                    <FieldLabel>{t("fieldSettingsTitle")}</FieldLabel>
                    <FieldDescription>
                        {t("fieldVisibilityIntroDescription")}
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
    const t = useDebugTranslations("settings.calendarData")
    const tMembersTable = useDebugTranslations("settings.membersTable")
    const tCommonLabels = useDebugTranslations("common.labels")
    const tEventForm = useDebugTranslations("event.form")
    const tSidebarEvents = useDebugTranslations("calendar.sidebarEvents")
    const locale = useLocale() as "ko" | "en"
    const eventFormStatusItems = useEventFormStatusItems()
    const eventStatusLabelMap = Object.fromEntries(
        eventFormStatusItems.map((item) => [item.value, item.label] as const)
    ) as Record<CalendarEventStatus, string>
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

                toast.success(t("eventStatusUpdated"))
            } catch (error) {
                console.error(
                    "Failed to update calendar event statuses:",
                    error
                )
                setEvents(previousEvents)
                toast.error(t("eventStatusUpdateFailed"))
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
                        ? t("eventCollectionUpdated")
                        : t("eventCollectionRemoved")
                )
            } catch (error) {
                console.error(
                    "Failed to update calendar event collections:",
                    error
                )
                setEvents(previousEvents)
                toast.error(t("eventCollectionUpdateFailed"))
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

                toast.success(t("eventDeleted"))
            } catch (error) {
                console.error("Failed to delete calendar events:", error)
                setEvents(previousEvents)
                toast.error(t("eventDeleteFailed"))
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
                    toast.error(t("collectionVisibilityUpdateFailed"))
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
                    toast.error(t("collectionColorUpdateFailed"))
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
            toast.message(t("collectionDuplicateName"))
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
            toast.success(t("collectionCreated"))
        } catch (error) {
            console.error("Failed to create calendar collection:", error)
            toast.error(t("collectionCreateFailed"))
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
                    toast.success(t("collectionDeleted"))
                } catch (error) {
                    console.error(
                        "Failed to delete calendar collection:",
                        error
                    )
                    toast.error(t("collectionDeleteFailed"))
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
                    label: event.author?.name ?? t("unknownAuthor"),
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
                eventFormStatusItems,
                locale,
                labels: {
                    selectAllAria: tMembersTable("selectAllAria"),
                    selectRowAria: tMembersTable("selectRowAria"),
                    eventHeader: t("tableEventHeader"),
                    newEvent: tCommonLabels("newEvent"),
                    authorHeader: t("tableAuthorHeader"),
                    unknownUser: tCommonLabels("unknownUser"),
                    dateHeader: tSidebarEvents("date"),
                    statusHeader: tSidebarEvents("status"),
                    statusPlaceholder: t("statusSelectPlaceholder"),
                    statusLabel: tSidebarEvents("status"),
                    collectionHeader: tSidebarEvents("collection"),
                    collectionPlaceholder: t("collectionSelectPlaceholder"),
                    collectionLabel: tSidebarEvents("collection"),
                    noCollection: t("noCollection"),
                    deleteEvent: tSidebarEvents("deleteEvent"),
                },
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
            eventFormStatusItems,
            locale,
            removeEvents,
            t,
            tCommonLabels,
            tEventForm,
            tMembersTable,
            tSidebarEvents,
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
    const noCollectionLabel = t("filterNoCollection")
    const selectedCollectionLabels = useMemo(
        () =>
            selectedCollectionIds.flatMap(
                (collectionId): SelectedCollectionLabel[] => {
                    if (collectionId === WITHOUT_COLLECTION_FILTER_KEY) {
                        return [
                            {
                                id: collectionId,
                                label: noCollectionLabel,
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
        [eventCollectionMap, noCollectionLabel, selectedCollectionIds]
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
                {t("selectCalendarHint")}
            </div>
        )
    }

    if (!canViewData) {
        return (
            <div className="text-sm text-muted-foreground">
                {t("membersOnlyView")}
            </div>
        )
    }

    return (
        <FieldGroup>
            <FieldSet>
                <FieldGroup>
                    <Field className="gap-4">
                        <FieldContent>
                            <FieldLabel>{t("eventListLabel")}</FieldLabel>
                            <FieldDescription>
                                {t("eventListDescription")}
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
                                emptyMessage={t("eventListEmpty")}
                                filterColumnId="event"
                                filterPlaceholder={t("eventListFilterPlaceholder")}
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
                                                {t("filterButton")}
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
                                                        {t("filterReset")}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                </>
                                            ) : null}
                                            <DropdownMenuLabel>
                                                {t("filterAuthorLabel")}
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
                                                    {t("filterAuthorEmpty")}
                                                </DropdownMenuItem>
                                            )}

                                            <DropdownMenuSeparator />
                                            <DropdownMenuLabel>
                                                {t("filterCollectionLabel")}
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
                                                {t("filterNoCollection")}
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
                                                    {t("filterNoCollection")}
                                                </DropdownMenuItem>
                                            )}

                                            <DropdownMenuSeparator />
                                            <DropdownMenuLabel>
                                                {t("filterStatusLabel")}
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
                                                {t("filterReset")}
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
                                                    {t("bulkEditButton", { count: selectedEvents.length })}
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                                align="end"
                                                className="w-56"
                                            >
                                                <DropdownMenuLabel>
                                                    {t("bulkEditLabel")}
                                                </DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuSub>
                                                    <DropdownMenuSubTrigger>
                                                        <CalendarRangeIcon />
                                                        {t("bulkStatusChange")}
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
                                                        {t("bulkCollectionChange")}
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
                                                            {t("bulkNoCollection")}
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
                            <FieldLabel>{t("collectionListLabel")}</FieldLabel>
                            <FieldDescription>
                                {t("collectionListDescription")}
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
