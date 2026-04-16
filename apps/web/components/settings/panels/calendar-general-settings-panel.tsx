"use client"

import { useSettingsModal } from "@/components/settings/settings-modal-provider"
import { AvatarUploadControl } from "@/components/settings/shared/avatar-upload-control"
import { NameInputControl } from "@/components/settings/shared/name-input-control"
import { useCalendarEventLayout } from "@/hooks/use-calendar-event-layout"
import { compressAvatarImage, validateAvatarImage } from "@/lib/avatar-image"
import { deleteOwnedCalendar, leaveCalendar } from "@/lib/calendar/mutations"
import {
    canManageCalendar,
    type CalendarAccessMode,
} from "@/lib/calendar/permissions"
import {
    MAX_CALENDAR_NAME_LENGTH,
    MIN_DISPLAY_NAME_LENGTH,
} from "@/lib/validation"
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
    AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSeparator,
    FieldSet,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@workspace/ui/components/select"
import { useRouter } from "next/navigation"
import { ChangeEvent, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

export function CalendarGeneralSettingsPanel() {
    const router = useRouter()
    const { closeSettings } = useSettingsModal()
    const { activeCalendar, eventLayout, saveEventLayout } =
        useCalendarEventLayout()
    const activeCalendarMembership = useCalendarStore(
        (s) => s.activeCalendarMembership
    )
    const myCalendars = useCalendarStore((s) => s.myCalendars)
    const setMyCalendars = useCalendarStore((s) => s.setMyCalendars)
    const clearActiveCalendarContext = useCalendarStore(
        (s) => s.clearActiveCalendarContext
    )
    const updateCalendarSnapshot = useCalendarStore(
        (s) => s.updateCalendarSnapshot
    )
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const [calendarName, setCalendarName] = useState(activeCalendar?.name ?? "")
    const [isSavingName, setIsSavingName] = useState(false)
    const [isSavingSecurity, setIsSavingSecurity] = useState(false)
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
    const [isRemovingAvatar, setIsRemovingAvatar] = useState(false)
    const [ownerCount, setOwnerCount] = useState(0)
    const [isLeavingCalendar, setIsLeavingCalendar] = useState(false)
    const [isDeletingCalendar, setIsDeletingCalendar] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [deleteConfirmation, setDeleteConfirmation] = useState("")

    useEffect(() => {
        setCalendarName(activeCalendar?.name ?? "")
    }, [activeCalendar?.name])

    useEffect(() => {
        if (!activeCalendar || activeCalendar.id === "demo") {
            setOwnerCount(0)
            return
        }

        let isCancelled = false

        const loadOwnerCount = async () => {
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

                const rows =
                    (data as
                        | {
                              role: "viewer" | "editor" | "manager" | "owner"
                              status: "active" | "pending"
                          }[]
                        | null) ?? []

                setOwnerCount(
                    rows.filter(
                        (member) =>
                            member.role === "owner" &&
                            member.status === "active"
                    ).length
                )
            } catch (error) {
                console.error("Failed to load calendar owner count:", error)
                if (!isCancelled) {
                    setOwnerCount(0)
                }
            }
        }

        void loadOwnerCount()

        return () => {
            isCancelled = true
        }
    }, [activeCalendar])

    const trimmedCalendarName = calendarName.trim()
    const hasCalendarNameLengthError =
        trimmedCalendarName.length < MIN_DISPLAY_NAME_LENGTH ||
        trimmedCalendarName.length > MAX_CALENDAR_NAME_LENGTH

    useEffect(() => {
        if (
            !activeCalendar ||
            activeCalendar.id === "demo" ||
            !canManageCalendar(activeCalendarMembership)
        ) {
            return
        }

        const nextName = trimmedCalendarName
        const currentName = activeCalendar.name.trim()

        if (
            !nextName ||
            nextName.length < MIN_DISPLAY_NAME_LENGTH ||
            nextName.length > MAX_CALENDAR_NAME_LENGTH ||
            nextName === currentName
        ) {
            return
        }

        const timeout = window.setTimeout(async () => {
            setIsSavingName(true)

            try {
                const supabase = createBrowserSupabase()
                const { error } = await supabase
                    .from("calendars")
                    .update({ name: nextName })
                    .eq("id", activeCalendar.id)

                if (error) {
                    throw error
                }

                updateCalendarSnapshot(activeCalendar.id, { name: nextName })
            } catch (error) {
                console.error("Failed to update calendar name:", error)
                toast.error("캘린더 이름을 저장하지 못했습니다.")
            } finally {
                setIsSavingName(false)
            }
        }, 500)

        return () => window.clearTimeout(timeout)
    }, [
        activeCalendar,
        activeCalendarMembership,
        trimmedCalendarName,
        updateCalendarSnapshot,
    ])

    if (!activeCalendar) {
        return (
            <div className="text-sm text-muted-foreground">
                캘린더를 선택하면 일반 설정을 변경할 수 있습니다.
            </div>
        )
    }

    const isDemoCalendar = activeCalendar.id === "demo"
    const canManageSettings =
        !isDemoCalendar && canManageCalendar(activeCalendarMembership)
    const isOwner = activeCalendarMembership.role === "owner"
    const canDeleteCalendar = isOwner
    const canLeaveCalendar =
        activeCalendarMembership.isMember && (!isOwner || ownerCount >= 2)
    const canDeleteLastCalendar = myCalendars.length > 1
    const deleteConfirmationTarget = activeCalendar.name
    const isDeleteConfirmationMatched =
        deleteConfirmation.trim() === deleteConfirmationTarget

    const handleLeaveCalendar = async () => {
        if (!activeCalendar || !canLeaveCalendar || isLeavingCalendar) {
            return
        }

        setIsLeavingCalendar(true)

        try {
            const supabase = createBrowserSupabase()
            const ok = await leaveCalendar(supabase, activeCalendar.id)

            if (!ok) {
                toast.error("캘린더를 나가지 못했습니다.")
                return
            }

            setMyCalendars(
                myCalendars.filter(
                    (calendar) => calendar.id !== activeCalendar.id
                )
            )
            clearActiveCalendarContext()
            closeSettings()
            toast.success("캘린더에서 나갔습니다.")
            router.push("/calendar")
            router.refresh()
        } catch (error) {
            console.error("Failed to leave calendar:", error)
            toast.error("캘린더를 나가지 못했습니다.")
        } finally {
            setIsLeavingCalendar(false)
        }
    }

    const handleDeleteCalendar = async () => {
        if (
            !activeCalendar ||
            !canDeleteCalendar ||
            !canDeleteLastCalendar ||
            isDeletingCalendar
        ) {
            return
        }

        setIsDeletingCalendar(true)

        try {
            const supabase = createBrowserSupabase()

            if (activeCalendar.avatarUrl) {
                const { error: removeAvatarError } = await supabase.storage
                    .from("calendar-avatars")
                    .remove([`${activeCalendar.id}/avatar.webp`])

                if (removeAvatarError) {
                    console.error(
                        "Calendar avatar remove before delete failed:",
                        removeAvatarError
                    )
                }
            }

            const ok = await deleteOwnedCalendar(supabase, activeCalendar.id)

            if (!ok) {
                toast.error("캘린더를 삭제하지 못했습니다.")
                return
            }

            setMyCalendars(
                myCalendars.filter(
                    (calendar) => calendar.id !== activeCalendar.id
                )
            )
            clearActiveCalendarContext()
            closeSettings()
            setDeleteConfirmation("")
            setIsDeleteDialogOpen(false)
            toast.success("캘린더를 삭제했습니다.")
            router.push("/calendar")
            router.refresh()
        } catch (error) {
            console.error("Failed to delete calendar:", error)
            toast.error("캘린더를 삭제하지 못했습니다.")
        } finally {
            setIsDeletingCalendar(false)
        }
    }

    const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]

        if (!file || !canManageSettings) {
            return
        }

        const validationMessage = validateAvatarImage(file)

        if (validationMessage) {
            toast.error(validationMessage)
            event.target.value = ""
            return
        }

        setIsUploadingAvatar(true)

        try {
            const supabase = createBrowserSupabase()
            const compressedFile = await compressAvatarImage(file)
            const path = `${activeCalendar.id}/avatar.webp`
            const uploadOptions = {
                cacheControl: "3600",
                contentType: compressedFile.type,
            }
            const { error: uploadError } = activeCalendar.avatarUrl
                ? await supabase.storage
                      .from("calendar-avatars")
                      .update(path, compressedFile, uploadOptions)
                : await supabase.storage
                      .from("calendar-avatars")
                      .upload(path, compressedFile, uploadOptions)

            if (uploadError) {
                throw uploadError
            }

            const { data: publicUrlData } = supabase.storage
                .from("calendar-avatars")
                .getPublicUrl(path)

            const avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`
            const { error: updateError } = await supabase
                .from("calendars")
                .update({ avatar_url: avatarUrl })
                .eq("id", activeCalendar.id)

            if (updateError) {
                throw updateError
            }

            updateCalendarSnapshot(activeCalendar.id, { avatarUrl })
            toast.success("캘린더 이미지가 업데이트되었습니다.")
        } catch (error) {
            console.error("Calendar avatar upload failed:", error)
            toast.error("캘린더 이미지 업로드에 실패했습니다.")
        } finally {
            setIsUploadingAvatar(false)
            event.target.value = ""
        }
    }

    const handleAvatarRemove = async () => {
        if (!activeCalendar.avatarUrl || !canManageSettings) {
            return
        }

        setIsRemovingAvatar(true)

        try {
            const supabase = createBrowserSupabase()
            const { error: removeError } = await supabase.storage
                .from("calendar-avatars")
                .remove([`${activeCalendar.id}/avatar.webp`])

            if (removeError) {
                throw removeError
            }

            const { error: updateError } = await supabase
                .from("calendars")
                .update({ avatar_url: null })
                .eq("id", activeCalendar.id)

            if (updateError) {
                throw updateError
            }

            updateCalendarSnapshot(activeCalendar.id, { avatarUrl: null })
            toast.success("캘린더 이미지가 삭제되었습니다.")
        } catch (error) {
            console.error("Calendar avatar remove failed:", error)
            toast.error("캘린더 이미지 삭제에 실패했습니다.")
        } finally {
            setIsRemovingAvatar(false)
        }
    }

    const handleAccessModeChange = async (accessMode: CalendarAccessMode) => {
        if (!canManageSettings || accessMode === activeCalendar.accessMode) {
            return
        }

        setIsSavingSecurity(true)

        try {
            const supabase = createBrowserSupabase()
            const { error } = await supabase
                .from("calendars")
                .update({ access_mode: accessMode })
                .eq("id", activeCalendar.id)

            if (error) {
                throw error
            }

            updateCalendarSnapshot(activeCalendar.id, { accessMode })
            toast.success("캘린더 보안 설정이 업데이트되었습니다.")
        } catch (error) {
            console.error("Failed to update calendar access mode:", error)
            toast.error("캘린더 보안 설정을 저장하지 못했습니다.")
        } finally {
            setIsSavingSecurity(false)
        }
    }

    return (
        <FieldGroup>
            <FieldSet>
                <FieldLegend className="mb-4 font-semibold">
                    캘린더 설정
                </FieldLegend>
                <FieldGroup>
                    {!canManageSettings && (
                        <p className="text-sm text-muted-foreground">
                            관리자 또는 소유자만 이 캘린더 설정을 변경할 수
                            있습니다.
                        </p>
                    )}
                    <Field>
                        <FieldContent>
                            <FieldLabel>캘린더 이름</FieldLabel>
                        </FieldContent>

                        <NameInputControl
                            value={calendarName}
                            placeholder="캘린더 이름 입력.."
                            onChange={setCalendarName}
                            invalid={hasCalendarNameLengthError}
                            isSaving={isSavingName}
                            disabled={!canManageSettings || isSavingName}
                            minLength={MIN_DISPLAY_NAME_LENGTH}
                            maxLength={MAX_CALENDAR_NAME_LENGTH}
                            className="w-100!"
                        />
                        {hasCalendarNameLengthError && (
                            <p className="text-xs text-destructive">
                                {MIN_DISPLAY_NAME_LENGTH}자 이상{" "}
                                {MAX_CALENDAR_NAME_LENGTH}자 이하로 입력해
                                주세요.
                            </p>
                        )}
                    </Field>
                    <Field>
                        <FieldContent>
                            <FieldLabel>캘린더 이미지</FieldLabel>
                            <FieldDescription>
                                이 이미지는 사이드바와 알림에 표시됩니다
                            </FieldDescription>
                        </FieldContent>

                        <AvatarUploadControl
                            fileInputRef={fileInputRef}
                            imageUrl={activeCalendar.avatarUrl}
                            name={activeCalendar.name}
                            isUploading={isUploadingAvatar}
                            isRemoving={isRemovingAvatar}
                            disabled={!canManageSettings}
                            onFileChange={handleAvatarUpload}
                            onRemove={() => {
                                void handleAvatarRemove()
                            }}
                        />
                    </Field>
                    <Field orientation="horizontal" className="items-center!">
                        <FieldContent>
                            <FieldLabel>캘린더 보안</FieldLabel>
                            <FieldDescription>
                                공개 범위와 가입 방식을 함께 설정합니다.
                            </FieldDescription>
                        </FieldContent>

                        <Select
                            value={activeCalendar.accessMode}
                            onValueChange={(value) => {
                                if (
                                    value === "public_open" ||
                                    value === "public_approval" ||
                                    value === "private"
                                ) {
                                    void handleAccessModeChange(value)
                                }
                            }}
                            disabled={!canManageSettings || isSavingSecurity}
                        >
                            <SelectTrigger className="w-full max-w-54">
                                <SelectValue placeholder="캘린더 보안" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>캘린더 보안</SelectLabel>
                                    <SelectItem value="public_open">
                                        공개 · 바로 참여
                                    </SelectItem>
                                    <SelectItem value="public_approval">
                                        공개 · 승인 후 참여
                                    </SelectItem>
                                    <SelectItem value="private">
                                        비공개 · 초대 전용
                                    </SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field orientation="horizontal" className="items-center!">
                        <FieldContent>
                            <FieldLabel>일정 레이아웃</FieldLabel>
                            <FieldDescription>
                                {"'"}
                                {activeCalendar.name}
                                {"'"} 캘린더의 기본 일정 표시 방식을 설정합니다.
                            </FieldDescription>
                        </FieldContent>

                        <Select
                            value={eventLayout}
                            onValueChange={(value) => {
                                if (value === "compact" || value === "split") {
                                    void saveEventLayout(value)
                                }
                            }}
                            disabled={!canManageSettings}
                        >
                            <SelectTrigger className="w-full max-w-38">
                                <SelectValue placeholder="테마 설정" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>일정 레이아웃</SelectLabel>
                                    <SelectItem value="compact">
                                        일정 위로 쌓기
                                    </SelectItem>
                                    <SelectItem value="split">
                                        일정 맞추기
                                    </SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </Field>
                </FieldGroup>
            </FieldSet>
            <FieldSeparator />
            <FieldSet>
                <FieldLegend className="mb-4 font-semibold">
                    위험 구역
                </FieldLegend>
                <FieldGroup>
                    {canLeaveCalendar && (
                        <Field
                            orientation="horizontal"
                            className="items-center!"
                        >
                            <FieldContent>
                                <FieldLabel>캘린더 나가기</FieldLabel>
                                <FieldDescription>
                                    {isOwner && ownerCount < 2
                                        ? "마지막 소유자는 캘린더를 나갈 수 없습니다. 다른 소유자를 추가하거나 캘린더를 삭제해 주세요."
                                        : "이 캘린더에서 계정을 제거하면 자체 페이지를 포함하여 워크스페이스 및 모든 콘텐츠에 대한 사용 권한을 잃게 됩니다."}
                                </FieldDescription>
                            </FieldContent>

                            <AlertDialog
                                open={isDeleteDialogOpen}
                                onOpenChange={(open) => {
                                    setIsDeleteDialogOpen(open)

                                    if (!open) {
                                        setDeleteConfirmation("")
                                    }
                                }}
                            >
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="destructive"
                                        disabled={isLeavingCalendar}
                                    >
                                        캘린더 나가기
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent size="sm">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            캘린더에서 나가시겠습니까?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            이 작업은 내 멤버십만 제거하며, 내가
                                            작성한 일정은 캘린더에 그대로
                                            유지됩니다.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>
                                            취소
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            variant="destructive"
                                            disabled={isLeavingCalendar}
                                            onClick={() => {
                                                void handleLeaveCalendar()
                                            }}
                                        >
                                            {isLeavingCalendar
                                                ? "처리 중..."
                                                : "캘린더 나가기"}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </Field>
                    )}
                    {canDeleteCalendar && (
                        <Field
                            orientation="horizontal"
                            className="items-center!"
                        >
                            <FieldContent>
                                <FieldLabel>캘린더 삭제하기</FieldLabel>
                                <FieldDescription>
                                    {canDeleteLastCalendar
                                        ? "모든 일정을 포함하여 이 캘린더를 영구적으로 삭제합니다."
                                        : "마지막 남은 내 캘린더는 삭제할 수 없습니다."}
                                </FieldDescription>
                            </FieldContent>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="destructive"
                                        disabled={
                                            !canDeleteLastCalendar ||
                                            isDeletingCalendar
                                        }
                                    >
                                        캘린더 삭제하기
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent size="sm">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            캘린더를 삭제하시겠습니까?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            이 작업은 캘린더, 멤버, 일정을 모두
                                            영구적으로 삭제하며 되돌릴 수
                                            없습니다.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <div className="grid gap-2">
                                        <p className="text-sm text-muted-foreground">
                                            삭제하려면{" "}
                                            <span className="font-medium text-foreground">
                                                {deleteConfirmationTarget}
                                            </span>
                                            를 입력해 주세요.
                                        </p>
                                        <Input
                                            value={deleteConfirmation}
                                            onChange={(event) =>
                                                setDeleteConfirmation(
                                                    event.target.value
                                                )
                                            }
                                            placeholder={deleteConfirmationTarget}
                                            aria-label="캘린더 삭제 확인"
                                        />
                                    </div>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>
                                            취소
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            variant="destructive"
                                            disabled={
                                                !canDeleteLastCalendar ||
                                                isDeletingCalendar ||
                                                !isDeleteConfirmationMatched
                                            }
                                            onClick={() => {
                                                void handleDeleteCalendar()
                                            }}
                                        >
                                            {isDeletingCalendar
                                                ? "삭제 중..."
                                                : "캘린더 삭제하기"}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </Field>
                    )}
                </FieldGroup>
            </FieldSet>
        </FieldGroup>
    )
}
