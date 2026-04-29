"use client"

import type { Locale } from "@/lib/i18n/config"
import {
    EventStatusItem,
    type EventFormStatusItem,
} from "@/components/calendar/event-form-status-field"
import type { DataTableColumnMeta } from "@/components/settings/shared/data-table"
import { getCalendarCollectionLabelClassName } from "@/lib/calendar/collection-color"
import { formatCalendarEventRecurrenceOrDateLabel } from "@/lib/calendar/event-date-format"
import { eventStatus } from "@/store/calendar-store.types"
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

export const editableStatuses = [...eventStatus]

type CalendarDataColumnLabels = {
    selectAllAria: string
    selectRowAria: string
    eventHeader: string
    newEvent: string
    authorHeader: string
    unknownUser: string
    dateHeader: string
    statusHeader: string
    statusPlaceholder: string
    statusLabel: string
    collectionHeader: string
    collectionPlaceholder: string
    collectionLabel: string
    noCollection: string
    deleteEvent: string
}

function renderCollectionBadges(
    collections: CalendarEventCollection[],
    labels: Pick<CalendarDataColumnLabels, "noCollection">
) {
    if (collections.length === 0) {
        return (
            <Badge variant="outline" className="text-muted-foreground">
                {labels.noCollection}
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
    eventFormStatusItems,
    onStatusChange,
    onCollectionChange,
    onDeleteEvent,
    locale,
    labels,
}: {
    canManageEvents: boolean
    collectionOptions: {
        id: string
        label: string
        color: CalendarEventCollection["options"]["color"]
    }[]
    eventFormStatusItems: EventFormStatusItem[]
    onStatusChange: (
        eventId: string,
        nextStatus: CalendarEventStatus
    ) => void | Promise<void>
    onCollectionChange: (
        eventId: string,
        nextCollectionId: string | null
    ) => void | Promise<void>
    onDeleteEvent: (eventId: string) => void | Promise<void>
    locale: Locale
    labels: CalendarDataColumnLabels
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
                              aria-label={labels.selectAllAria}
                          />
                      ),
                      cell: ({ row }) => (
                          <Checkbox
                              checked={row.getIsSelected()}
                              onCheckedChange={(value) =>
                                  row.toggleSelected(!!value)
                              }
                              disabled={!row.original.canManage}
                              aria-label={labels.selectRowAria}
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
            header: labels.eventHeader,
            filterFn: (row, columnId, value) => {
                const rawValue = String(row.getValue(columnId)).toLowerCase()
                return rawValue.includes(String(value).toLowerCase())
            },
            cell: ({ row }) =>
                row.original.title === "" ? labels.newEvent : row.original.title,
        },
        {
            accessorKey: "author",
            meta: {
                headClassName: "min-w-36",
                cellClassName: "min-w-36",
            } satisfies DataTableColumnMeta,
            header: labels.authorHeader,
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
                            {row.original.author?.name ?? labels.unknownUser}
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
            accessorFn: (row) =>
                formatCalendarEventRecurrenceOrDateLabel(row, { locale }),
            header: labels.dateHeader,
            cell: ({ row }) =>
                formatCalendarEventRecurrenceOrDateLabel(row.original, {
                    locale,
                }),
        },
        {
            accessorKey: "status",
            meta: {
                headClassName: "w-20",
                cellClassName: "w-20",
            } satisfies DataTableColumnMeta,
            header: labels.statusHeader,
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
                                <SelectValue
                                    placeholder={labels.statusPlaceholder}
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>
                                        {labels.statusLabel}
                                    </SelectLabel>
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
            header: labels.collectionHeader,
            cell: ({ row }) => {
                const event = row.original
                const selectedCollectionId =
                    event.collectionIds[0] ?? "__none__"

                if (!collectionOptions.length || !canManageEvents) {
                    return renderCollectionBadges(event.collections, labels)
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
                                <SelectValue
                                    placeholder={labels.collectionPlaceholder}
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>
                                        {labels.collectionLabel}
                                    </SelectLabel>
                                    <SelectItem value="__none__">
                                        {labels.noCollection}
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
                                              {labels.deleteEvent}
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
