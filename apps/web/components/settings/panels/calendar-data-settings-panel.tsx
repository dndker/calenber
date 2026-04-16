"use client"

import {
    getCalendarDataColumns,
    type CalendarDataRow,
} from "@/components/settings/panels/calendar-data-table-columns"
import { DataTable } from "@/components/settings/shared/data-table"
import {
    deleteCalendarEvent,
    updateCalendarEvent,
} from "@/lib/calendar/mutations"
import { canManageCalendar } from "@/lib/calendar/permissions"
import type { CalendarEventStatus } from "@/store/calendar-store.types"
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
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
    CalendarRangeIcon,
    CircleXIcon,
    ListFilterIcon,
    ListFilterPlusIcon,
    XIcon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

type CalendarEventRecord = CalendarDataRow

export function CalendarDataSettingsPanel() {
    const activeCalendar = useCalendarStore((s) => s.activeCalendar)
    const activeCalendarMembership = useCalendarStore(
        (s) => s.activeCalendarMembership
    )
    const [events, setEvents] = useState<CalendarEventRecord[]>([])
    const eventsRef = useRef<CalendarEventRecord[]>([])
    const [selectedAuthors, setSelectedAuthors] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const canManageEvents = canManageCalendar(activeCalendarMembership)

    useEffect(() => {
        eventsRef.current = events
    }, [events])

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

                if (results.some((result) => !result)) {
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
                                            {selectedAuthors.length > 0 && (
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
                                            )}

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
                                                            {author.email && (
                                                                <div className="truncate text-xs text-muted-foreground">
                                                                    {
                                                                        author.email
                                                                    }
                                                                </div>
                                                            )}
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
                                                    취소됨
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onSelect={() => {
                                                        void removeEvents(
                                                            selectedEvents.map(
                                                                (event) =>
                                                                    event.id
                                                            )
                                                        )
                                                        table.resetRowSelection()
                                                    }}
                                                >
                                                    선택한 일정 삭제
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )
                                }}
                            />
                        )}
                    </Field>
                </FieldGroup>
            </FieldSet>
            <FieldSeparator />
        </FieldGroup>
    )
}
