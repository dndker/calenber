"use client"

import {
    getCalendarMemberColumns,
    type CalendarMemberRow,
} from "@/components/settings/panels/calendar-members-table-columns"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { DataTable } from "@/components/settings/shared/data-table"
import { canViewCalendarSettings } from "@/lib/calendar/permissions"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
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
import { UsersIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

type CalendarMemberRecord = {
    id: string
    user_id: string
    role: CalendarMemberRow["role"]
    status: "active" | "pending"
    created_at: string
    email: string | null
    name: string | null
    avatar_url: string | null
}

export function CalendarMembersSettingsPanel() {
    const t = useDebugTranslations("settings.membersPanel")
    const tTable = useDebugTranslations("settings.membersTable")
    const tRoles = useDebugTranslations("common.roles")
    const tCommon = useDebugTranslations("common.actions")
    const tLabels = useDebugTranslations("common.labels")
    const labels = useMemo(
        () => ({
            roles: {
                viewer: tRoles("viewer"),
                editor: tRoles("editor"),
                manager: tRoles("manager"),
                owner: tRoles("owner"),
            } satisfies Record<CalendarMemberRow["role"], string>,
            selectAllAria: tTable("selectAllAria"),
            selectRowAria: tTable("selectRowAria"),
            memberHeader: tTable("memberHeader"),
            meBadge: tTable("meBadge"),
            joinedAtHeader: tTable("joinedAtHeader"),
            roleHeader: tTable("roleHeader"),
            roleSelectPlaceholder: tTable("roleSelectPlaceholder"),
            roleSelectLabel: tTable("roleSelectLabel"),
            removeMember: tTable("removeMember"),
        }),
        [tRoles, tTable]
    )
    const user = useAuthStore((s) => s.user)
    const activeCalendar = useCalendarStore((s) => s.activeCalendar)
    const activeCalendarMembership = useCalendarStore(
        (s) => s.activeCalendarMembership
    )
    const [members, setMembers] = useState<CalendarMemberRow[]>([])
    const membersRef = useRef<CalendarMemberRow[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
    const [memberToRemove, setMemberToRemove] =
        useState<CalendarMemberRow | null>(null)
    const [isRemovingMember, setIsRemovingMember] = useState(false)
    const removeDialogResetTimeoutRef = useRef<number | null>(null)

    const canManageMembers =
        activeCalendarMembership.role === "manager" ||
        activeCalendarMembership.role === "owner"
    const canViewMembers = canViewCalendarSettings(activeCalendarMembership)

    useEffect(() => {
        membersRef.current = members
    }, [members])

    useEffect(() => {
        return () => {
            if (removeDialogResetTimeoutRef.current) {
                window.clearTimeout(removeDialogResetTimeoutRef.current)
            }
        }
    }, [])

    const getAssignableRoles = useCallback(
        (member: CalendarMemberRow): CalendarMemberRow["role"][] => {
            if (!member.canEditRole) {
                return [] as CalendarMemberRow["role"][]
            }

            if (activeCalendarMembership.role === "owner") {
                return ["viewer", "editor", "manager", "owner"]
            }

            if (activeCalendarMembership.role === "manager") {
                return ["viewer", "editor"]
            }

            return [] as CalendarMemberRow["role"][]
        },
        [activeCalendarMembership.role]
    )

    const updateMembersRole = useCallback(
        async (memberIds: string[], nextRole: CalendarMemberRow["role"]) => {
            if (!activeCalendar || !memberIds.length) {
                return
            }

            const previousMembers = membersRef.current

            setMembers((current) =>
                current.map((member) =>
                    memberIds.includes(member.id)
                        ? { ...member, role: nextRole }
                        : member
                )
            )

            try {
                const supabase = createBrowserSupabase()
                const { error } = await supabase
                    .from("calendar_members")
                    .update({ role: nextRole })
                    .in("id", memberIds)
                    .eq("calendar_id", activeCalendar.id)

                if (error) {
                    throw error
                }

                toast.success(t("roleUpdated"))
            } catch (error) {
                console.error("Failed to update calendar member roles:", error)
                setMembers(previousMembers)
                toast.error(t("roleUpdateFailed"))
            }
        },
        [activeCalendar, t]
    )

    const handleRemoveMember = useCallback(async () => {
        if (!activeCalendar || !memberToRemove || isRemovingMember) {
            return
        }

        setIsRemovingMember(true)

        const previousMembers = membersRef.current

        setMembers((current) =>
            current.filter((member) => member.id !== memberToRemove.id)
        )

        try {
            const supabase = createBrowserSupabase()
            const { error } = await supabase.rpc("remove_calendar_member", {
                target_member_id: memberToRemove.id,
            })

            if (error) {
                throw error
            }

            toast.success(t("memberRemoved"))
            setIsRemoveDialogOpen(false)
            setMemberToRemove(null)
        } catch (error) {
            console.error("Failed to remove calendar member:", error)
            setMembers(previousMembers)
            toast.error(t("memberRemoveFailed"))
        } finally {
            setIsRemovingMember(false)
        }
    }, [activeCalendar, isRemovingMember, memberToRemove, t])

    const columns = useMemo(
        () =>
            getCalendarMemberColumns({
                canManageMembers,
                getAssignableRoles,
                onRoleChange: async (memberId, nextRole) => {
                    await updateMembersRole([memberId], nextRole)
                },
                onRemove: (member) => {
                    setMemberToRemove(member)
                    setIsRemoveDialogOpen(true)
                },
                labels,
            }),
        [canManageMembers, getAssignableRoles, labels, updateMembersRole]
    )

    useEffect(() => {
        if (!canViewMembers) {
            setMembers([])
            setIsLoading(false)
            return
        }

        if (!activeCalendar || activeCalendar.id === "demo") {
            setMembers([])
            setIsLoading(false)
            return
        }

        let isCancelled = false

        const loadMembers = async () => {
            setIsLoading(true)

            try {
                const supabase = createBrowserSupabase()
                const { data, error } = await supabase.rpc(
                    "get_calendar_member_directory",
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

                const rows = (data as CalendarMemberRecord[] | null) ?? []

                setMembers(
                    rows.map((member) => {
                        const isCurrentUser = member.user_id === user?.id

                        return {
                            id: member.id,
                            userId: member.user_id,
                            role: member.role,
                            status: member.status,
                            createdAt: member.created_at,
                            displayName:
                                member.name?.trim() ||
                                (isCurrentUser ? user?.name : null) ||
                                tLabels("noName"),
                            email:
                                member.email ??
                                (isCurrentUser ? user?.email : null),
                            avatarUrl:
                                member.avatar_url ??
                                (isCurrentUser ? user?.avatarUrl : null),
                            isCurrentUser,
                            canEditRole:
                                canManageMembers &&
                                !isCurrentUser &&
                                (activeCalendarMembership.role === "owner" ||
                                    (activeCalendarMembership.role ===
                                        "manager" &&
                                        (member.role === "viewer" ||
                                            member.role === "editor"))),
                            canRemove:
                                canManageMembers &&
                                !isCurrentUser &&
                                (activeCalendarMembership.role === "owner" ||
                                    (activeCalendarMembership.role ===
                                        "manager" &&
                                        (member.role === "viewer" ||
                                            member.role === "editor"))),
                        }
                    })
                )
            } catch (error) {
                console.error("Failed to load calendar members:", error)
                if (!isCancelled) {
                    setMembers([])
                }
            } finally {
                if (!isCancelled) {
                    setIsLoading(false)
                }
            }
        }

        void loadMembers()

        return () => {
            isCancelled = true
        }
    }, [
        activeCalendar,
        user,
        canManageMembers,
        canViewMembers,
        activeCalendarMembership.role,
    ])

    if (!activeCalendar) {
        return (
            <div className="text-sm text-muted-foreground">
                {t("selectCalendar")}
            </div>
        )
    }

    if (!canViewMembers) {
        return (
            <div className="text-sm text-muted-foreground">
                {t("membersOnlyView")}
            </div>
        )
    }

    return (
        <FieldGroup>
            <AlertDialog
                open={isRemoveDialogOpen}
                onOpenChange={(open) => {
                    setIsRemoveDialogOpen(open)

                    if (open) {
                        return
                    }

                    if (removeDialogResetTimeoutRef.current) {
                        window.clearTimeout(removeDialogResetTimeoutRef.current)
                    }

                    // Wait for the close animation so the content doesn't blank out mid-transition.
                    removeDialogResetTimeoutRef.current = window.setTimeout(() => {
                        setMemberToRemove(null)
                        removeDialogResetTimeoutRef.current = null
                    }, 150)
                }}
            >
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t("removeDialogTitle")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {memberToRemove
                                ? (
                                      <>
                                          &quot;{memberToRemove.displayName}
                                          &quot;
                                          {t("removeDialogNamedSuffix")}
                                          <br />
                                          {t("removeDialogNamedDescription")}
                                      </>
                                  )
                                : t("removeDialogDescription")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={!memberToRemove || isRemovingMember}
                            onClick={() => {
                                void handleRemoveMember()
                            }}
                        >
                            {isRemovingMember
                                ? t("processing")
                                : tTable("removeMember")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <FieldSet>
                <FieldGroup>
                    <Field orientation="horizontal" className="items-center!">
                        <FieldContent>
                            <FieldLabel>{t("inviteByLinkLabel")}</FieldLabel>
                            <FieldDescription>
                                {t("inviteByLinkDescription")}
                            </FieldDescription>
                        </FieldContent>
                        <Button variant="secondary" disabled={!canManageMembers}>
                            {tCommon("copy")}
                        </Button>
                    </Field>
                </FieldGroup>
            </FieldSet>
            <FieldSet>
                <FieldGroup>
                    <Field className="gap-4">
                        <FieldContent>
                            <FieldLabel>{t("memberListLabel")}</FieldLabel>
                            <FieldDescription>
                                {t("memberListDescription")}
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
                                data={members}
                                emptyMessage={t("emptyMembers")}
                                filterColumnId="member"
                                filterPlaceholder={t("filterPlaceholder")}
                                enableRowSelection={(row) =>
                                    row.original.canEditRole
                                }
                                bulkActions={(table) => {
                                    const selectedRows =
                                        table.getFilteredSelectedRowModel().rows
                                    const selectedMembers = selectedRows
                                        .map((row) => row.original)
                                        .filter((member) => member.canEditRole)

                                    if (
                                        !canManageMembers ||
                                        !selectedMembers.length
                                    ) {
                                        return null
                                    }

                                    const availableRoles = Array.from(
                                        new Set(
                                            selectedMembers.flatMap((member) =>
                                                getAssignableRoles(member)
                                            )
                                        )
                                    ) as CalendarMemberRow["role"][]

                                    return (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                >
                                                    <UsersIcon />
                                                    {t("bulkRoleChange")}
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                                align="end"
                                                className="w-44"
                                            >
                                                {availableRoles.map((role) => (
                                                    <DropdownMenuItem
                                                        key={role}
                                                        onSelect={() => {
                                                            void updateMembersRole(
                                                                selectedMembers.map(
                                                                    (member) =>
                                                                        member.id
                                                                ),
                                                                role
                                                            )
                                                            table.resetRowSelection()
                                                        }}
                                                    >
                                                        {labels.roles[role]}
                                                    </DropdownMenuItem>
                                                ))}
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
