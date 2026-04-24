"use client"

import { useSettingsModal } from "@/components/settings/settings-modal-provider"
import { AvatarUploadControl } from "@/components/settings/shared/avatar-upload-control"
import { NameInputControl } from "@/components/settings/shared/name-input-control"
import { compressAvatarImage, validateAvatarImage } from "@/lib/avatar-image"
import { deleteCurrentUserAccount } from "@/lib/calendar/mutations"
import { MAX_USER_NAME_LENGTH, MIN_DISPLAY_NAME_LENGTH } from "@/lib/validation"
import { useAuthStore } from "@/store/useAuthStore"
import type { AppUser } from "@workspace/lib/supabase/map-user"
import { useCalendarStore } from "@/store/useCalendarStore"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { mapUser } from "@workspace/lib/supabase/map-user"
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
import { Switch } from "@workspace/ui/components/switch"
import { useRouter } from "next/navigation"
import { ChangeEvent, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

function ProfileSettingsAccountIdentity({ user }: { user: AppUser }) {
    const setUser = useAuthStore((s) => s.setUser)
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const [name, setName] = useState(user.name ?? "")
    const [isSavingName, setIsSavingName] = useState(false)
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
    const [isRemovingAvatar, setIsRemovingAvatar] = useState(false)

    const trimmedName = name.trim()
    const hasNameLengthError =
        trimmedName.length < MIN_DISPLAY_NAME_LENGTH ||
        trimmedName.length > MAX_USER_NAME_LENGTH

    useEffect(() => {
        const nextName = trimmedName
        const currentName = user.name?.trim() ?? ""

        if (
            !nextName ||
            nextName.length < MIN_DISPLAY_NAME_LENGTH ||
            nextName.length > MAX_USER_NAME_LENGTH
        ) {
            return
        }

        if (nextName === currentName) {
            return
        }

        const timeout = window.setTimeout(async () => {
            setIsSavingName(true)

            try {
                const supabase = createBrowserSupabase()
                const { data, error } = await supabase.auth.updateUser({
                    data: {
                        name: nextName,
                        avatar_url: user.avatarUrl,
                    },
                })

                if (error) {
                    throw error
                }

                setUser(mapUser(data.user))
            } catch (error) {
                console.error("Failed to update profile name:", error)
                toast.error("이름을 저장하지 못했습니다.")
            } finally {
                setIsSavingName(false)
            }
        }, 500)

        return () => window.clearTimeout(timeout)
    }, [setUser, trimmedName, user])

    const getAuthenticatedUserId = async () => {
        const supabase = createBrowserSupabase()
        const {
            data: { user: authUser },
            error,
        } = await supabase.auth.getUser()

        if (error) {
            throw error
        }

        if (!authUser) {
            throw new Error("로그인 정보를 확인하지 못했습니다.")
        }

        return {
            supabase,
            authUserId: authUser.id,
        }
    }

    const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]

        if (!file) {
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
            const { supabase, authUserId } = await getAuthenticatedUserId()
            const compressedFile = await compressAvatarImage(file)
            const path = `${authUserId}/avatar.webp`
            const uploadOptions = {
                cacheControl: "3600",
                contentType: compressedFile.type,
            }
            const { error: uploadError } = user.avatarUrl
                ? await supabase.storage
                      .from("avatars")
                      .update(path, compressedFile, uploadOptions)
                : await supabase.storage
                      .from("avatars")
                      .upload(path, compressedFile, uploadOptions)

            if (uploadError) {
                console.error("Avatar upload storage error:", {
                    uploadError,
                    path,
                    storeUserId: user.id,
                    authUserId,
                })
                throw uploadError
            }

            const { data: publicUrlData } = supabase.storage
                .from("avatars")
                .getPublicUrl(path)

            const avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`
            const { data, error: updateError } = await supabase.auth.updateUser(
                {
                    data: {
                        name: trimmedName,
                        avatar_url: avatarUrl,
                    },
                }
            )

            if (updateError) {
                throw updateError
            }

            setUser(mapUser(data.user))
            toast.success("프로필 이미지가 업데이트되었습니다.")
        } catch (error) {
            console.error("Avatar upload failed:", error)
            toast.error("프로필 이미지 업로드에 실패했습니다.")
        } finally {
            setIsUploadingAvatar(false)
            event.target.value = ""
        }
    }

    const handleAvatarRemove = async () => {
        if (!user.avatarUrl) {
            return
        }

        setIsRemovingAvatar(true)

        try {
            const { supabase, authUserId } = await getAuthenticatedUserId()
            const { error: removeError } = await supabase.storage
                .from("avatars")
                .remove([`${authUserId}/avatar.webp`])

            if (removeError) {
                throw removeError
            }

            const { data, error: updateError } = await supabase.auth.updateUser(
                {
                    data: {
                        name: trimmedName,
                        avatar_url: null,
                    },
                }
            )

            if (updateError) {
                throw updateError
            }

            setUser(mapUser(data.user))
            toast.success("프로필 이미지가 삭제되었습니다.")
        } catch (error) {
            console.error("Avatar remove failed:", error)
            toast.error("프로필 이미지 삭제에 실패했습니다.")
        } finally {
            setIsRemovingAvatar(false)
        }
    }

    return (
        <Field orientation="horizontal" className="items-center! gap-4">
            <AvatarUploadControl
                fileInputRef={fileInputRef}
                imageUrl={user.avatarUrl}
                name={user.name}
                isUploading={isUploadingAvatar}
                isRemoving={isRemovingAvatar}
                onFileChange={handleAvatarUpload}
                onRemove={() => {
                    void handleAvatarRemove()
                }}
            />
            <div className="flex flex-col gap-2">
                <NameInputControl
                    value={name}
                    placeholder="이름 입력.."
                    onChange={setName}
                    invalid={hasNameLengthError}
                    isSaving={isSavingName}
                    disabled={isSavingName}
                    minLength={MIN_DISPLAY_NAME_LENGTH}
                    maxLength={MAX_USER_NAME_LENGTH}
                    className="w-46"
                />
                {hasNameLengthError && (
                    <p className="text-xs text-destructive">
                        {MIN_DISPLAY_NAME_LENGTH}자 이상 {MAX_USER_NAME_LENGTH}자
                        이하로 입력해 주세요.
                    </p>
                )}
            </div>
        </Field>
    )
}

export function ProfileSettingsPanel() {
    const router = useRouter()
    const { closeSettings } = useSettingsModal()
    const user = useAuthStore((s) => s.user)
    const setUser = useAuthStore((s) => s.setUser)
    const setMyCalendars = useCalendarStore((s) => s.setMyCalendars)
    const clearActiveCalendarContext = useCalendarStore(
        (s) => s.clearActiveCalendarContext
    )
    const [isDeletingAccount, setIsDeletingAccount] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [deleteConfirmation, setDeleteConfirmation] = useState("")

    if (!user) return null

    const deleteConfirmationTarget = user.email ?? "계정 삭제"
    const isDeleteConfirmationMatched =
        deleteConfirmation.trim() === deleteConfirmationTarget

    const getAuthenticatedUserId = async () => {
        const supabase = createBrowserSupabase()
        const {
            data: { user: authUser },
            error,
        } = await supabase.auth.getUser()

        if (error) {
            throw error
        }

        if (!authUser) {
            throw new Error("로그인 정보를 확인하지 못했습니다.")
        }

        return {
            supabase,
            authUserId: authUser.id,
        }
    }

    const handleDeleteAccount = async () => {
        if (!user || isDeletingAccount) {
            return
        }

        setIsDeletingAccount(true)

        try {
            const { supabase, authUserId } = await getAuthenticatedUserId()
            const { data: createdCalendars, error: calendarsError } =
                await supabase
                    .from("calendars")
                    .select("id")
                    .eq("created_by", authUserId)

            if (calendarsError) {
                throw calendarsError
            }

            if (user.avatarUrl) {
                const { error: removeAvatarError } = await supabase.storage
                    .from("avatars")
                    .remove([`${authUserId}/avatar.webp`])

                if (removeAvatarError) {
                    console.error(
                        "User avatar remove before account delete failed:",
                        removeAvatarError
                    )
                }
            }

            const createdCalendarAvatarPaths =
                (createdCalendars as { id: string }[] | null)?.map(
                    (calendar) => `${calendar.id}/avatar.webp`
                ) ??
                []

            if (createdCalendarAvatarPaths.length > 0) {
                const { error: removeCalendarAvatarsError } =
                    await supabase.storage
                        .from("calendar-avatars")
                        .remove(createdCalendarAvatarPaths)

                if (removeCalendarAvatarsError) {
                    console.error(
                        "Calendar avatar remove before account delete failed:",
                        removeCalendarAvatarsError
                    )
                }
            }

            const ok = await deleteCurrentUserAccount(supabase)

            if (!ok) {
                toast.error("계정을 삭제하지 못했습니다.")
                return
            }

            await supabase.auth.signOut()
            setUser(null)
            setMyCalendars([])
            clearActiveCalendarContext()
            closeSettings()
            setDeleteConfirmation("")
            setIsDeleteDialogOpen(false)
            toast.success("계정이 삭제되었습니다.")
            router.replace("/signin")
            router.refresh()
        } catch (error) {
            console.error("Failed to delete account:", error)
            toast.error("계정을 삭제하지 못했습니다.")
        } finally {
            setIsDeletingAccount(false)
        }
    }

    return (
        <div>
            <FieldGroup>
                <FieldSet>
                    <FieldLegend className="mb-4 font-semibold">
                        계정
                    </FieldLegend>
                    {/* <FieldDescription>
                        All transactions are secure and encrypted
                    </FieldDescription> */}
                    <FieldGroup>
                        <ProfileSettingsAccountIdentity
                            key={user.id}
                            user={user}
                        />
                        <Field
                            orientation="horizontal"
                            className="items-center!"
                        >
                            <FieldContent>
                                <FieldLabel htmlFor="switch-focus-mode">
                                    Share across devices
                                </FieldLabel>
                                <FieldDescription>
                                    Focus is shared across devices, and turns
                                    off when you leave the app.
                                </FieldDescription>
                            </FieldContent>
                            <Switch id="switch-focus-mode" />
                        </Field>
                    </FieldGroup>
                </FieldSet>
                <FieldSeparator />
                <FieldSet>
                    <FieldLegend className="mb-4 font-semibold">
                        계정 보안
                    </FieldLegend>
                    <FieldGroup>
                        <Field
                            orientation="horizontal"
                            className="items-center!"
                        >
                            <FieldContent>
                                <FieldLabel htmlFor="switch-focus-mode">
                                    이메일
                                </FieldLabel>
                                <FieldDescription>
                                    example@gmail.com
                                </FieldDescription>
                            </FieldContent>
                            <Button variant="outline">이메일 관리</Button>
                        </Field>
                        <Field
                            orientation="horizontal"
                            className="items-center!"
                        >
                            <FieldContent>
                                <FieldLabel htmlFor="switch-focus-mode">
                                    비밀번호
                                </FieldLabel>
                                <FieldDescription>
                                    계정 비밀번호를 설정하세요.
                                </FieldDescription>
                            </FieldContent>
                            <Button variant="outline">비밀번호 설정</Button>
                        </Field>
                        <Field
                            orientation="horizontal"
                            className="items-center!"
                        >
                            <FieldContent>
                                <FieldLabel htmlFor="switch-focus-mode">
                                    2단계 인증
                                </FieldLabel>
                                <FieldDescription>
                                    계정 보안 방식을 추가하세요.
                                </FieldDescription>
                            </FieldContent>
                            <Button variant="outline">인증 방법 추가</Button>
                        </Field>
                    </FieldGroup>
                </FieldSet>
                <FieldSeparator />
                <FieldSet>
                    <FieldLegend className="mb-4 font-semibold">
                        지원
                    </FieldLegend>
                    <FieldGroup>
                        <Field
                            orientation="horizontal"
                            className="items-center!"
                        >
                            <FieldContent>
                                <FieldLabel htmlFor="switch-focus-mode">
                                    내 계정 삭제
                                </FieldLabel>
                                <FieldDescription>
                                    계정을 영구적으로 삭제합니다. 더 이상 내가
                                    만든 캘린더나 소속된 캘린더에 접근할 수
                                    없게됩니다.
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
                                        disabled={isDeletingAccount}
                                    >
                                        내 계정 삭제
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent size="sm">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            계정을 삭제하시겠습니까?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            프로필, 내가 만든 캘린더, 내가 작성한
                                            일정과 멤버십이 모두 영구적으로
                                            삭제되며 되돌릴 수 없습니다.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <div className="grid gap-2">
                                        <p className="text-sm text-muted-foreground">
                                            계속하려면{" "}
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
                                            aria-label="계정 삭제 확인"
                                        />
                                    </div>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>
                                            취소
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            variant="destructive"
                                            disabled={
                                                isDeletingAccount ||
                                                !isDeleteConfirmationMatched
                                            }
                                            onClick={() => {
                                                void handleDeleteAccount()
                                            }}
                                        >
                                            {isDeletingAccount
                                                ? "삭제 중..."
                                                : "내 계정 삭제"}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </Field>
                    </FieldGroup>
                </FieldSet>
            </FieldGroup>
        </div>
    )
}
