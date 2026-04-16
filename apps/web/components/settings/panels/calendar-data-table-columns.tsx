"use client"

import type { DataTableColumnMeta } from "@/components/settings/shared/data-table"
import dayjs from "@/lib/dayjs"
import type {
    CalendarEvent,
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
    "id" | "title" | "start" | "end" | "status" | "author"
> & {
    canManage: boolean
}

const statusLabelMap: Record<CalendarEventStatus, string> = {
    scheduled: "시작 전",
    in_progress: "진행 중",
    completed: "완료",
    cancelled: "취소됨",
}

const statusVariantMap: Record<
    CalendarEventStatus,
    "outline" | "secondary" | "default" | "destructive"
> = {
    scheduled: "outline",
    in_progress: "secondary",
    completed: "default",
    cancelled: "destructive",
}

const editableStatuses: CalendarEventStatus[] = [
    "scheduled",
    "in_progress",
    "completed",
    "cancelled",
]

export function getCalendarDataColumns({
    canManageEvents,
    onStatusChange,
    onDeleteEvent,
}: {
    canManageEvents: boolean
    onStatusChange: (
        eventId: string,
        nextStatus: CalendarEventStatus
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
            header: "일정",
            filterFn: (row, columnId, value) => {
                const rawValue = String(row.getValue(columnId)).toLowerCase()
                return rawValue.includes(String(value).toLowerCase())
            },
            cell: ({ row }) => row.original.title,
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
                            <AvatarFallback className="text-2xl leading-normal font-medium">
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
            accessorKey: "start",
            header: "시작일",
            cell: ({ row }) => dayjs(row.original.start).format("YYYY.MM.DD"),
        },
        {
            accessorKey: "end",
            header: "종료일",
            cell: ({ row }) => dayjs(row.original.end).format("YYYY.MM.DD"),
        },
        {
            accessorKey: "status",
            header: "상태",
            cell: ({ row }) => {
                const event = row.original

                if (!canManageEvents) {
                    return (
                        <Badge variant={statusVariantMap[event.status]}>
                            {statusLabelMap[event.status]}
                        </Badge>
                    )
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
                            <SelectTrigger className="-ml-2 w-23 border-0 px-2 shadow-none hover:bg-muted">
                                <SelectValue placeholder="상태 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>상태</SelectLabel>
                                    {editableStatuses.map((status) => (
                                        <SelectItem key={status} value={status}>
                                            {statusLabelMap[status]}
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
