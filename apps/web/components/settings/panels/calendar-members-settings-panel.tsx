"use client"

import {
    getCalendarMemberColumns,
    type CalendarMemberRow,
} from "@/components/settings/panels/calendar-members-table-columns"
import { DataTable } from "@/components/settings/shared/data-table"
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

                toast.success("멤버 권한이 업데이트되었습니다.")
            } catch (error) {
                console.error("Failed to update calendar member roles:", error)
                setMembers(previousMembers)
                toast.error("멤버 권한을 변경하지 못했습니다.")
            }
        },
        [activeCalendar]
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

            toast.success("멤버를 내보냈습니다.")
            setIsRemoveDialogOpen(false)
            setMemberToRemove(null)
        } catch (error) {
            console.error("Failed to remove calendar member:", error)
            setMembers(previousMembers)
            toast.error("멤버를 내보내지 못했습니다.")
        } finally {
            setIsRemovingMember(false)
        }
    }, [activeCalendar, isRemovingMember, memberToRemove])

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
            }),
        [canManageMembers, getAssignableRoles, updateMembersRole]
    )

    useEffect(() => {
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
                                "이름 없음",
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
    }, [activeCalendar, user, canManageMembers, activeCalendarMembership.role])

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
                            멤버를 내보내시겠습니까?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {memberToRemove
                                ? (
                                      <>
                                          "{memberToRemove.displayName}"의
                                          캘린더 접근 권한을 제거합니다.
                                          <br />
                                          이 작업은 이후 다시 초대해서 되돌릴 수
                                          있습니다.
                                      </>
                                  )
                                : "선택한 멤버의 캘린더 접근 권한을 제거합니다."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={!memberToRemove || isRemovingMember}
                            onClick={() => {
                                void handleRemoveMember()
                            }}
                        >
                            {isRemovingMember ? "처리 중..." : "멤버 내보내기"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <FieldSet>
                <FieldGroup>
                    <Field orientation="horizontal" className="items-center!">
                        <FieldContent>
                            <FieldLabel>링크로 멤버 추가</FieldLabel>
                            <FieldDescription>
                                이 캘린더에 멤버를 초대할 수 있는 권한이 있는
                                사용자만 이 링크를 볼 수 있습니다.
                            </FieldDescription>
                        </FieldContent>
                        <Button variant="secondary">링크 복사</Button>
                    </Field>
                </FieldGroup>
            </FieldSet>
            <FieldSet>
                <FieldGroup>
                    <Field className="gap-4">
                        <FieldContent>
                            <FieldLabel>멤버 목록</FieldLabel>
                            <FieldDescription>
                                현재 이 캘린더에 접근할 수 있는 멤버와 권한을
                                확인합니다.
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
                                emptyMessage="참여 중인 멤버가 없습니다."
                                filterColumnId="member"
                                filterPlaceholder="이름, 이메일 또는 ID로 검색"
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
                                                    선택한 멤버 권한 변경
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
                                                        {role === "viewer"
                                                            ? "보기 전용"
                                                            : role === "editor"
                                                              ? "편집자"
                                                              : role ===
                                                                  "manager"
                                                                ? "관리자"
                                                                : "소유자"}
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
