"use client"

import {
    EventStatusItem,
    eventFormStatusItems,
} from "@/components/calendar/event-form-status-field"
import type { DataTableColumnMeta } from "@/components/settings/shared/data-table"
import { getCalendarCollectionLabelClassName } from "@/lib/calendar/collection-color"
import { formatCalendarEventRecurrenceOrDateLabel } from "@/lib/calendar/event-date-format"
import type {
    CalendarEvent,
    CalendarEventCollection,
    CalendarEventStatus,
} from "@/store/calendar-store.types"
import type { ColumnDef } from "@tanstack/react-table"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@workspace/ui/components/select"
import { MoreHorizontalIcon } from "lucide-react"

export type CalendarDataRow = Pick<
    CalendarEvent,
    | "id"
    | "title"
    | "start"
    | "end"
    | "allDay"
    | "timezone"
    | "status"
    | "author"
    | "collectionIds"
    | "collections"
    | "recurrence"
    | "recurrenceInstance"
> & {
    canManage: boolean
}

export const editableStatuses: CalendarEventStatus[] = eventFormStatusItems.map(
    (item) => item.value
)

function renderCollectionBadges(collections: CalendarEventCollection[]) {
    if (collections.length === 0) {
        return (
            <Badge variant="outline" className="text-muted-foreground">
                컬렉션 없음
            </Badge>
        )
    }

    const visibleCollections = collections.slice(0, 2)
    const hiddenCount = collections.length - visibleCollections.length

    return (
        <div className="flex flex-wrap items-center gap-1">
            {visibleCollections.map((collection) => (
                <Badge
                    key={collection.id}
                    variant="outline"
                    className={getCalendarCollectionLabelClassName(
                        collection.options.color,
                        "border-transparent"
                    )}
                >
                    {collection.name}
                </Badge>
            ))}
            {hiddenCount > 0 ? (
                <Badge variant="outline" className="text-muted-foreground">
                    +{hiddenCount}
                </Badge>
            ) : null}
        </div>
    )
}

export function getCalendarDataColumns({
    canManageEvents,
    collectionOptions,
    onStatusChange,
    onCollectionChange,
    onDeleteEvent,
}: {
    canManageEvents: boolean
    collectionOptions: {
        id: string
        label: string
        color: CalendarEventCollection["options"]["color"]
    }[]
    onStatusChange: (
        eventId: string,
        nextStatus: CalendarEventStatus
    ) => void | Promise<void>
    onCollectionChange: (
        eventId: string,
        nextCollectionId: string | null
    ) => void | Promise<void>
    onDeleteEvent: (eventId: string) => void | Promise<void>
}): ColumnDef<CalendarDataRow>[] {
    return [
        ...(canManageEvents
            ? [
                  {
                      id: "select",
                      meta: {
                          headClassName: "w-5.5",
                          cellClassName: "w-5.5",
                      } satisfies DataTableColumnMeta,
                      enableSorting: false,
                      enableHiding: false,
                      header: ({ table }) => (
                          <Checkbox
                              checked={
                                  table.getIsAllPageRowsSelected() ||
                                  (table.getIsSomePageRowsSelected() &&
                                      "indeterminate")
                              }
                              onCheckedChange={(value) =>
                                  table.toggleAllPageRowsSelected(!!value)
                              }
                              aria-label="전체 선택"
                          />
                      ),
                      cell: ({ row }) => (
                          <Checkbox
                              checked={row.getIsSelected()}
                              onCheckedChange={(value) =>
                                  row.toggleSelected(!!value)
                              }
                              disabled={!row.original.canManage}
                              aria-label="행 선택"
                          />
                      ),
                  } satisfies ColumnDef<CalendarDataRow>,
              ]
            : []),
        {
            id: "event",
            meta: {
                headClassName: "w-full",
                cellClassName: "w-full",
            } satisfies DataTableColumnMeta,
            accessorFn: (row) =>
                [row.title, row.author?.name, row.author?.email]
                    .filter(Boolean)
                    .join(" "),
            header: "일정 이름",
            filterFn: (row, columnId, value) => {
                const rawValue = String(row.getValue(columnId)).toLowerCase()
                return rawValue.includes(String(value).toLowerCase())
            },
            cell: ({ row }) =>
                row.original.title === "" ? "새 일정" : row.original.title,
        },
        {
            accessorKey: "author",
            meta: {
                headClassName: "min-w-36",
                cellClassName: "min-w-36",
            } satisfies DataTableColumnMeta,
            header: "작성자",
            cell: ({ row }) => {
                return (
                    <div className="flex items-center gap-2">
                        <Avatar
                            size="sm"
                            className="size-5.5! ring-1 ring-border"
                        >
                            <AvatarImage
                                className="cursor-pointer"
                                src={
                                    row.original.author?.avatarUrl ?? undefined
                                }
                                alt={row.original.author?.name || ""}
                            />
                            <AvatarFallback className="text-2xl leading-[normal] font-medium">
                                {row.original.author?.name?.[0]?.toUpperCase() ||
                                    ""}
                            </AvatarFallback>
                        </Avatar>

                        <span className="truncate">
                            {row.original.author?.name ?? "알 수 없는 사용자"}
                        </span>
                    </div>
                )
            },
        },
        {
            id: "date",
            meta: {
                headClassName: "min-w-36",
                cellClassName: "min-w-36",
            } satisfies DataTableColumnMeta,
            accessorFn: (row) => formatCalendarEventRecurrenceOrDateLabel(row),
            header: "날짜",
            cell: ({ row }) => formatCalendarEventRecurrenceOrDateLabel(row.original),
        },
        {
            accessorKey: "status",
            meta: {
                headClassName: "w-20",
                cellClassName: "w-20",
            } satisfies DataTableColumnMeta,
            header: "상태",
            cell: ({ row }) => {
                const event = row.original

                if (!canManageEvents) {
                    return <EventStatusItem value={event.status} />
                }

                return (
                    <div className="w-full max-w-40">
                        <Select
                            value={event.status}
                            onValueChange={(value) => {
                                if (value === event.status) {
                                    return
                                }

                                void onStatusChange(
                                    event.id,
                                    value as CalendarEventStatus
                                )
                            }}
                            disabled={!event.canManage}
                        >
                            <SelectTrigger className="-ml-2 w-25 border-0 px-2 shadow-none hover:bg-muted">
                                <SelectValue placeholder="상태 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>상태</SelectLabel>
                                    {eventFormStatusItems.map((status) => (
                                        <SelectItem
                                            key={status.value}
                                            value={status.value}
                                        >
                                            <EventStatusItem
                                                value={status.value}
                                                size="sm"
                                            />
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                )
            },
        },
        {
            accessorKey: "collections",
            meta: {
                headClassName: "min-w-40",
                cellClassName: "min-w-40",
            } satisfies DataTableColumnMeta,
            accessorFn: (row) =>
                row.collections.map((collection) => collection.name).join(" "),
            header: "컬렉션",
            cell: ({ row }) => {
                const event = row.original
                const selectedCollectionId =
                    event.collectionIds[0] ?? "__none__"

                if (!collectionOptions.length || !canManageEvents) {
                    return renderCollectionBadges(event.collections)
                }

                return (
                    <div className="w-full max-w-48">
                        <Select
                            value={selectedCollectionId}
                            onValueChange={(value) => {
                                const nextCollectionId =
                                    value === "__none__" ? null : value

                                if (
                                    nextCollectionId ===
                                    (event.collectionIds[0] ?? null)
                                ) {
                                    return
                                }

                                void onCollectionChange(
                                    event.id,
                                    nextCollectionId
                                )
                            }}
                            disabled={!event.canManage}
                        >
                            <SelectTrigger className="-ml-2 w-32 border-0 px-2 shadow-none hover:bg-muted">
                                <SelectValue placeholder="컬렉션 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>컬렉션</SelectLabel>
                                    <SelectItem value="__none__">
                                        컬렉션 없음
                                    </SelectItem>
                                    {collectionOptions.map((option) => (
                                        <SelectItem
                                            key={option.id}
                                            value={option.id}
                                        >
                                            <span
                                                className={getCalendarCollectionLabelClassName(
                                                    option.color,
                                                    "inline-flex h-6 items-center rounded-md px-1.5 leading-[normal]"
                                                )}
                                            >
                                                {option.label}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                )
            },
        },
        ...(canManageEvents
            ? [
                  {
                      id: "actions",
                      meta: {
                          headClassName: "w-5.5 text-right",
                          cellClassName: "w-5.5 text-right",
                      } satisfies DataTableColumnMeta,
                      enableSorting: false,
                      enableHiding: false,
                      cell: ({ row }) => {
                          const event = row.original

                          return (
                              <div className="flex justify-end">
                                  <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                          <Button
                                              variant="ghost"
                                              size="icon-sm"
                                              disabled={!event.canManage}
                                          >
                                              <MoreHorizontalIcon />
                                          </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent
                                          align="end"
                                          className="w-36"
                                      >
                                          <DropdownMenuItem
                                              className="text-destructive focus:text-destructive"
                                              onSelect={() => {
                                                  void onDeleteEvent(event.id)
                                              }}
                                          >
                                              일정 삭제
                                          </DropdownMenuItem>
                                      </DropdownMenuContent>
                                  </DropdownMenu>
                              </div>
                          )
                      },
                  } satisfies ColumnDef<CalendarDataRow>,
              ]
            : []),
    ]
}
