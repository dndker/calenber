"use client"

import {
    getCalendarDataColumns,
    type CalendarDataRow,
} from "@/components/settings/panels/calendar-data-table-columns"
import { DataTable } from "@/components/settings/shared/data-table"
import {
    createCalendarEventCategory,
    deleteCalendarEvent,
    deleteCalendarEventCategory,
    updateCalendarEvent,
    updateCalendarEventCategory,
} from "@/lib/calendar/mutations"
import { canManageCalendar } from "@/lib/calendar/permissions"
import type {
    CalendarEvent,
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
    DropdownMenuSeparator,
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
import { Input } from "@workspace/ui/components/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@workspace/ui/components/table"
import {
    CalendarRangeIcon,
    CircleXIcon,
    ListFilterIcon,
    ListFilterPlusIcon,
    Loader2Icon,
    MoreHorizontalIcon,
    PlusIcon,
    XIcon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

type CalendarEventRecord = CalendarDataRow

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

function replaceCategoryInEvent(
    event: CalendarEvent,
    nextCategory: CalendarEventCategory
) {
    if (!event.categoryIds.includes(nextCategory.id)) {
        return event
    }

    const nextCategories = event.categories.map((category) =>
        category.id === nextCategory.id ? nextCategory : category
    )

    return {
        ...event,
        categories: nextCategories,
        category: nextCategories[0] ?? null,
        categoryId: nextCategories[0]?.id ?? null,
        categoryIds: nextCategories.map((category) => category.id),
    }
}

function removeCategoryFromEvent(event: CalendarEvent, categoryId: string) {
    if (!event.categoryIds.includes(categoryId)) {
        return event
    }

    const nextCategories = event.categories.filter(
        (category) => category.id !== categoryId
    )

    return {
        ...event,
        categories: nextCategories,
        category: nextCategories[0] ?? null,
        categoryId: nextCategories[0]?.id ?? null,
        categoryIds: nextCategories.map((category) => category.id),
    }
}

function CategoryNameInput({
    category,
    disabled,
    isSaving,
    onRename,
}: {
    category: CalendarEventCategory
    disabled: boolean
    isSaving: boolean
    onRename: (categoryId: string, nextName: string) => Promise<boolean>
}) {
    const [draft, setDraft] = useState(category.name)
    const debounceRef = useRef<NodeJS.Timeout | null>(null)

    const flushRename = useCallback(
        async (value: string) => {
            const trimmedValue = value.trim()
            const trimmedName = category.name.trim()

            if (!trimmedValue) {
                setDraft(category.name)
                return
            }

            if (trimmedValue === trimmedName) {
                if (value !== category.name) {
                    setDraft(category.name)
                }
                return
            }

            const ok = await onRename(category.id, trimmedValue)

            if (!ok) {
                setDraft(category.name)
            }
        },
        [category.id, category.name, onRename]
    )

    useEffect(() => {
        if (disabled || isSaving) {
            return
        }

        const trimmedDraft = draft.trim()
        const trimmedName = category.name.trim()

        if (!trimmedDraft || trimmedDraft === trimmedName) {
            return
        }

        debounceRef.current = setTimeout(() => {
            void flushRename(draft)
        }, 450)

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current)
                debounceRef.current = null
            }
        }
    }, [category.name, disabled, draft, flushRename, isSaving])

    return (
        <div className="flex items-center gap-2">
            <Input
                value={draft}
                disabled={disabled}
                onChange={(event) => {
                    setDraft(event.target.value)
                }}
                onBlur={() => {
                    if (debounceRef.current) {
                        clearTimeout(debounceRef.current)
                        debounceRef.current = null
                    }

                    void flushRename(draft)
                }}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.currentTarget.blur()
                        return
                    }

                    if (event.key === "Escape") {
                        if (debounceRef.current) {
                            clearTimeout(debounceRef.current)
                            debounceRef.current = null
                        }

                        setDraft(category.name)
                        event.currentTarget.blur()
                    }
                }}
                className="h-9"
                placeholder="카테고리 이름"
            />
            {isSaving ? (
                <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
            ) : null}
        </div>
    )
}

export function CalendarDataSettingsPanel() {
    const activeCalendar = useCalendarStore((s) => s.activeCalendar)
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
    const setEventCategoryDefaultVisibility = useCalendarStore(
        (s) => s.setEventCategoryDefaultVisibility
    )
    const [events, setEvents] = useState<CalendarEventRecord[]>([])
    const eventsRef = useRef<CalendarEventRecord[]>([])
    const [selectedAuthors, setSelectedAuthors] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [newCategoryName, setNewCategoryName] = useState("")
    const [isCreatingCategory, setIsCreatingCategory] = useState(false)
    const [busyCategoryIds, setBusyCategoryIds] = useState<string[]>([])

    const canManageEvents = canManageCalendar(activeCalendarMembership)

    useEffect(() => {
        eventsRef.current = events
    }, [events])

    const syncCategoryOnEvents = useCallback((nextCategory: CalendarEventCategory) => {
        useCalendarStore.setState((state) => ({
            events: state.events.map((event) =>
                replaceCategoryInEvent(event, nextCategory)
            ),
            viewEvent: state.viewEvent
                ? replaceCategoryInEvent(state.viewEvent, nextCategory)
                : null,
        }))
    }, [])

    const removeCategoryFromEvents = useCallback((categoryId: string) => {
        useCalendarStore.setState((state) => ({
            events: state.events.map((event) =>
                removeCategoryFromEvent(event, categoryId)
            ),
            viewEvent: state.viewEvent
                ? removeCategoryFromEvent(state.viewEvent, categoryId)
                : null,
        }))
    }, [])

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
            if (!activeCalendar || !eventIds.length) {
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
        [activeCalendar]
    )

    const removeEvents = useCallback(
        async (eventIds: string[]) => {
            if (!activeCalendar || !eventIds.length) {
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
        [activeCalendar]
    )

    const renameCategory = useCallback(
        async (categoryId: string, nextName: string) => {
            if (!activeCalendar || !canManageEvents) {
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
                    syncCategoryOnEvents(updatedCategory)
                    return true
                } catch (error) {
                    console.error("Failed to rename calendar category:", error)
                    toast.error("카테고리 이름을 변경하지 못했습니다.")
                    return false
                }
            })
        },
        [
            activeCalendar,
            canManageEvents,
            syncCategoryOnEvents,
            upsertEventCategorySnapshot,
            withBusyCategory,
        ]
    )

    const changeCategoryDefaultVisibility = useCallback(
        async (category: CalendarEventCategory, visibleByDefault: boolean) => {
            if (!activeCalendar || !canManageEvents) {
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
                                visibleByDefault,
                            },
                        }
                    )

                    if (!updatedCategory) {
                        throw new Error("Category visibility update failed.")
                    }

                    upsertEventCategorySnapshot(updatedCategory)
                    setEventCategoryDefaultVisibility(
                        updatedCategory.id,
                        visibleByDefault
                    )
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
            activeCalendar,
            canManageEvents,
            setEventCategoryDefaultVisibility,
            upsertEventCategorySnapshot,
            withBusyCategory,
        ]
    )

    const createCategory = useCallback(async () => {
        if (!activeCalendar || activeCalendar.id === "demo" || !canManageEvents) {
            return
        }

        const trimmedName = newCategoryName.trim()

        if (!trimmedName) {
            return
        }

        const existingCategory = eventCategories.find(
            (category) =>
                category.name.trim().toLowerCase() ===
                trimmedName.toLowerCase()
        )

        if (existingCategory) {
            setNewCategoryName("")
            toast.message("이미 같은 이름의 카테고리가 있습니다.")
            return
        }

        setIsCreatingCategory(true)

        try {
            const supabase = createBrowserSupabase()
            const createdCategory = await createCalendarEventCategory(
                supabase,
                activeCalendar.id,
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
            setEventCategoryDefaultVisibility(createdCategory.id, true)
            setNewCategoryName("")
            toast.success("카테고리를 추가했습니다.")
        } catch (error) {
            console.error("Failed to create calendar category:", error)
            toast.error("카테고리를 추가하지 못했습니다.")
        } finally {
            setIsCreatingCategory(false)
        }
    }, [
        activeCalendar,
        canManageEvents,
        eventCategories,
        newCategoryName,
        setEventCategoryDefaultVisibility,
        upsertEventCategorySnapshot,
    ])

    const removeCategory = useCallback(
        async (category: CalendarEventCategory) => {
            if (!activeCalendar || !canManageEvents) {
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
                    removeCategoryFromEvents(category.id)
                    toast.success("카테고리를 삭제했습니다.")
                } catch (error) {
                    console.error("Failed to delete calendar category:", error)
                    toast.error("카테고리를 삭제하지 못했습니다.")
                }
            })
        },
        [
            activeCalendar,
            canManageEvents,
            removeCategoryFromEvents,
            removeEventCategorySnapshot,
            withBusyCategory,
        ]
    )

    const columns = useMemo(
        () =>
            getCalendarDataColumns({
                canManageEvents,
                onStatusChange: async (eventId, nextStatus) => {
                    await updateEventsStatus([eventId], nextStatus)
                },
                onDeleteEvent: async (eventId) => {
                    await removeEvents([eventId])
                },
            }),
        [canManageEvents, removeEvents, updateEventsStatus]
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

    const selectedAuthorSet = useMemo(
        () => new Set(selectedAuthors),
        [selectedAuthors]
    )

    const filteredEvents = useMemo(() => {
        if (!selectedAuthors.length) {
            return events
        }

        return events.filter((event) => {
            const authorKey =
                event.author?.id ??
                event.author?.email ??
                event.author?.name ??
                "unknown-author"

            return selectedAuthorSet.has(authorKey)
        })
    }, [events, selectedAuthors.length, selectedAuthorSet])

    const selectedAuthorLabels = useMemo(
        () =>
            authorOptions.filter((author) =>
                selectedAuthors.includes(author.key)
            ),
        [authorOptions, selectedAuthors]
    )

    const categoryRows = useMemo(() => {
        return sortCategoriesForSettings(eventCategories).map((category) => ({
            ...category,
            usageCount: calendarEvents.filter((event) =>
                event.categoryIds.includes(category.id)
            ).length,
        }))
    }, [calendarEvents, eventCategories])

    useEffect(() => {
        if (!activeCalendar || activeCalendar.id === "demo") {
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
                        target_calendar_id: activeCalendar.id,
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

                setEvents(
                    rows.map((event) => ({
                        id: event.id,
                        title: event.title ?? "",
                        start: event.start_at
                            ? new Date(event.start_at).valueOf()
                            : Date.now(),
                        end: event.end_at
                            ? new Date(event.end_at).valueOf()
                            : Date.now(),
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
                        canManage: canManageEvents,
                    }))
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
    }, [activeCalendar, canManageEvents])

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
                                                className="leading-normal"
                                            >
                                                {selectedAuthors.length > 0 ? (
                                                    <ListFilterIcon />
                                                ) : (
                                                    <ListFilterPlusIcon />
                                                )}
                                                작성자 필터
                                                {selectedAuthors.length > 0
                                                    ? `됨 (${selectedAuthors.length}명)`
                                                    : ""}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            align="end"
                                            className="w-56"
                                        >
                                            {selectedAuthors.length > 0 ? (
                                                <>
                                                    <DropdownMenuItem
                                                        onSelect={() => {
                                                            setSelectedAuthors(
                                                                []
                                                            )
                                                        }}
                                                    >
                                                        <CircleXIcon />
                                                        필터 초기화
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                </>
                                            ) : null}

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
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                                toolbarContent={
                                    selectedAuthorLabels.length > 0 ? (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm text-muted-foreground">
                                                작성자 필터:
                                            </span>
                                            {selectedAuthorLabels.map(
                                                (author) => (
                                                    <Badge
                                                        key={author.key}
                                                        variant="secondary"
                                                        className="h-6 gap-px"
                                                    >
                                                        {author.label}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            type="button"
                                                            className="size-3 p-0 text-muted-foreground/70 hover:text-primary"
                                                            onClick={(
                                                                event
                                                            ) => {
                                                                event.stopPropagation()
                                                                setSelectedAuthors(
                                                                    (current) =>
                                                                        current.filter(
                                                                            (
                                                                                item
                                                                            ) =>
                                                                                item !==
                                                                                author.key
                                                                        )
                                                                )
                                                            }}
                                                        >
                                                            <XIcon className="-mr-px size-3.25" />
                                                        </Button>
                                                    </Badge>
                                                )
                                            )}
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
                                                    <CalendarRangeIcon />
                                                    선택한 일정 상태 변경
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                                align="end"
                                                className="w-44"
                                            >
                                                <DropdownMenuItem
                                                    onSelect={() => {
                                                        void updateEventsStatus(
                                                            selectedEvents.map(
                                                                (event) =>
                                                                    event.id
                                                            ),
                                                            "scheduled"
                                                        )
                                                        table.resetRowSelection()
                                                    }}
                                                >
                                                    예정
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onSelect={() => {
                                                        void updateEventsStatus(
                                                            selectedEvents.map(
                                                                (event) =>
                                                                    event.id
                                                            ),
                                                            "in_progress"
                                                        )
                                                        table.resetRowSelection()
                                                    }}
                                                >
                                                    진행 중
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onSelect={() => {
                                                        void updateEventsStatus(
                                                            selectedEvents.map(
                                                                (event) =>
                                                                    event.id
                                                            ),
                                                            "completed"
                                                        )
                                                        table.resetRowSelection()
                                                    }}
                                                >
                                                    완료
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onSelect={() => {
                                                        void updateEventsStatus(
                                                            selectedEvents.map(
                                                                (event) =>
                                                                    event.id
                                                            ),
                                                            "cancelled"
                                                        )
                                                        table.resetRowSelection()
                                                    }}
                                                >
                                                    취소
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )
                                }}
                            />
                        )}
                    </Field>

                    <FieldSeparator />

                    <Field className="gap-4">
                        <FieldContent>
                            <FieldLabel>카테고리 목록</FieldLabel>
                            <FieldDescription>
                                모든 카테고리를 한 화면에서 추가하고, 이름을
                                바로 수정하고, 사이드바 기본 체크 상태를 설정할
                                수 있습니다.
                            </FieldDescription>
                        </FieldContent>

                        <div className="rounded-xl border">
                            <div className="flex flex-col gap-3 border-b px-3 py-3 sm:flex-row sm:items-center">
                                <div className="flex-1">
                                    <Input
                                        value={newCategoryName}
                                        disabled={
                                            !canManageEvents ||
                                            isCreatingCategory ||
                                            !activeCalendar ||
                                            activeCalendar.id === "demo"
                                        }
                                        onChange={(event) => {
                                            setNewCategoryName(
                                                event.target.value
                                            )
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault()
                                                void createCategory()
                                            }
                                        }}
                                        placeholder="새 카테고리 추가"
                                        className="h-9"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary">
                                        전체 {categoryRows.length}개
                                    </Badge>
                                    <Button
                                        type="button"
                                        size="sm"
                                        disabled={
                                            !canManageEvents ||
                                            isCreatingCategory ||
                                            !newCategoryName.trim()
                                        }
                                        onClick={() => {
                                            void createCategory()
                                        }}
                                    >
                                        {isCreatingCategory ? (
                                            <Loader2Icon className="animate-spin" />
                                        ) : (
                                            <PlusIcon />
                                        )}
                                        추가
                                    </Button>
                                </div>
                            </div>

                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-full">
                                            이름
                                        </TableHead>
                                        <TableHead className="w-34">
                                            초기 체크
                                        </TableHead>
                                        <TableHead className="w-28">
                                            연결 일정
                                        </TableHead>
                                        <TableHead className="w-12 text-right" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {categoryRows.length ? (
                                        categoryRows.map((category) => {
                                            const isBusy =
                                                busyCategoryIds.includes(
                                                    category.id
                                                )

                                            return (
                                                <TableRow key={category.id}>
                                                    <TableCell>
                                                        <div className="space-y-1">
                                                            <CategoryNameInput
                                                                key={`${category.id}-${category.updatedAt}`}
                                                                category={
                                                                    category
                                                                }
                                                                disabled={
                                                                    !canManageEvents ||
                                                                    isBusy
                                                                }
                                                                isSaving={
                                                                    isBusy
                                                                }
                                                                onRename={
                                                                    renameCategory
                                                                }
                                                            />
                                                            <p className="text-xs text-muted-foreground">
                                                                입력을 멈추면
                                                                자동 저장됩니다.
                                                            </p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Select
                                                            value={
                                                                category.options
                                                                    .visibleByDefault
                                                                    ? "visible"
                                                                    : "hidden"
                                                            }
                                                            onValueChange={(
                                                                value
                                                            ) => {
                                                                void changeCategoryDefaultVisibility(
                                                                    category,
                                                                    value ===
                                                                        "visible"
                                                                )
                                                            }}
                                                            disabled={
                                                                !canManageEvents ||
                                                                isBusy
                                                            }
                                                        >
                                                            <SelectTrigger className="h-9 w-full min-w-0">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="visible">
                                                                    기본 표시
                                                                </SelectItem>
                                                                <SelectItem value="hidden">
                                                                    기본 숨김
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant="outline"
                                                            className="font-normal"
                                                        >
                                                            {category.usageCount}
                                                            개 일정
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon-sm"
                                                                    disabled={
                                                                        !canManageEvents ||
                                                                        isBusy
                                                                    }
                                                                >
                                                                    {isBusy ? (
                                                                        <Loader2Icon className="animate-spin" />
                                                                    ) : (
                                                                        <MoreHorizontalIcon />
                                                                    )}
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem
                                                                    variant="destructive"
                                                                    onSelect={() => {
                                                                        void removeCategory(
                                                                            category
                                                                        )
                                                                    }}
                                                                >
                                                                    카테고리 삭제
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell
                                                colSpan={4}
                                                className="h-24 text-center text-muted-foreground"
                                            >
                                                등록된 카테고리가 없습니다.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Field>
                </FieldGroup>
            </FieldSet>
        </FieldGroup>
    )
}
