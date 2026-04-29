"use client"

import type { DataTableColumnMeta } from "@/components/settings/shared/data-table"
import dayjs from "@/lib/dayjs"
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

export type CalendarMemberRow = {
    id: string
    userId: string
    role: "viewer" | "editor" | "manager" | "owner"
    status: "active" | "pending"
    createdAt: string
    displayName: string
    email: string | null
    avatarUrl: string | null
    isCurrentUser: boolean
    canEditRole: boolean
    canRemove: boolean
}

function shortenUserId(userId: string) {
    return `${userId.slice(0, 8)}...${userId.slice(-4)}`
}

export function getCalendarMemberColumns({
    canManageMembers,
    getAssignableRoles,
    onRoleChange,
    onRemove,
    labels,
}: {
    canManageMembers: boolean
    getAssignableRoles: (
        member: CalendarMemberRow
    ) => CalendarMemberRow["role"][]
    onRoleChange: (
        memberId: string,
        nextRole: CalendarMemberRow["role"]
    ) => void | Promise<void>
    onRemove: (member: CalendarMemberRow) => void
    labels: {
        roles: Record<CalendarMemberRow["role"], string>
        selectAllAria: string
        selectRowAria: string
        memberHeader: string
        meBadge: string
        joinedAtHeader: string
        roleHeader: string
        roleSelectPlaceholder: string
        roleSelectLabel: string
        removeMember: string
    }
}): ColumnDef<CalendarMemberRow>[] {
    return [
        ...(canManageMembers
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
                              disabled={!row.original.canEditRole}
                              aria-label={labels.selectRowAria}
                          />
                      ),
                  } satisfies ColumnDef<CalendarMemberRow>,
              ]
            : []),
        {
            id: "member",

            meta: {
                headClassName: "w-full",
                cellClassName: "w-full",
            } satisfies DataTableColumnMeta,
            accessorFn: (row) =>
                [row.displayName, row.email, row.userId]
                    .filter(Boolean)
                    .join(" "),
            header: labels.memberHeader,
            filterFn: (row, columnId, value) => {
                const rawValue = String(row.getValue(columnId)).toLowerCase()
                return rawValue.includes(String(value).toLowerCase())
            },
            cell: ({ row }) => {
                const member = row.original

                return (
                    <div className="flex w-full items-center gap-3">
                        <Avatar className="size-9">
                            <AvatarImage
                                src={member.avatarUrl ?? undefined}
                                alt={member.displayName}
                            />
                            <AvatarFallback>
                                {member.displayName[0] ?? "?"}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="truncate font-medium">
                                        {member.displayName}
                                </span>
                                {member.isCurrentUser && (
                                    <Badge variant="outline">
                                        {labels.meBadge}
                                    </Badge>
                                )}
                            </div>
                            <div className="truncate text-sm text-muted-foreground">
                                {member.email ?? shortenUserId(member.userId)}
                            </div>
                        </div>
                    </div>
                )
            },
        },

        {
            accessorKey: "createdAt",
            header: labels.joinedAtHeader,
            cell: ({ row }) =>
                dayjs(row.original.createdAt).format("YYYY.MM.DD"),
        },
        {
            accessorKey: "role",
            header: labels.roleHeader,
            cell: ({ row }) => {
                const rowRole = row.original.role
                const member = row.original
                const assignableRoles = getAssignableRoles(member)
                const isRoleEditable =
                    canManageMembers &&
                    member.canEditRole &&
                    assignableRoles.length > 0

                return (
                    <div className="w-40">
                        <Select
                            value={rowRole}
                            onValueChange={(value) => {
                                if (value === rowRole) {
                                    return
                                }

                                void onRoleChange(
                                    member.id,
                                    value as CalendarMemberRow["role"]
                                )
                            }}
                            disabled={!isRoleEditable}
                        >
                            <SelectTrigger className="-ml-2 w-full border-0 px-2 shadow-none hover:bg-muted">
                                <SelectValue
                                    placeholder={
                                        labels.roleSelectPlaceholder
                                    }
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>
                                        {labels.roleSelectLabel}
                                    </SelectLabel>
                                    {!assignableRoles.includes(rowRole) && (
                                        <SelectItem value={rowRole}>
                                            {labels.roles[rowRole]}
                                        </SelectItem>
                                    )}
                                    {assignableRoles.map((role) => (
                                        <SelectItem key={role} value={role}>
                                            {labels.roles[role]}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                )
            },
        },
        ...(canManageMembers
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
                          const member = row.original

                          return (
                              <div className="flex justify-end">
                                  <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                          <Button
                                              variant="ghost"
                                              size="icon-sm"
                                              disabled={
                                                  !member.canEditRole &&
                                                  !member.canRemove
                                              }
                                          >
                                              <MoreHorizontalIcon />
                                          </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent
                                          align="end"
                                          className="w-40"
                                      >
                                          <DropdownMenuItem
                                              variant="destructive"
                                              disabled={!member.canRemove}
                                              onSelect={() => onRemove(member)}
                                          >
                                              {labels.removeMember}
                                          </DropdownMenuItem>
                                      </DropdownMenuContent>
                                  </DropdownMenu>
                              </div>
                          )
                      },
                  } satisfies ColumnDef<CalendarMemberRow>,
              ]
            : []),
    ]
}
