"use client"

import { useSettingsModal } from "@/components/settings/settings-modal-provider"
import { AvatarUploadControl } from "@/components/settings/shared/avatar-upload-control"
import { NameInputControl } from "@/components/settings/shared/name-input-control"
import { compressAvatarImage, validateAvatarImage } from "@/lib/avatar-image"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
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
    const tVal = useDebugTranslations("common.validation")
    const t = useDebugTranslations("settings.profilePanel")
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
                toast.error(t("nameSaveFailed"))
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
            throw new Error(t("authUserMissing"))
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

        const validationCode = validateAvatarImage(file)

        if (validationCode === "invalidType") {
            toast.error(tVal("invalidAvatarFileType"))
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
            toast.success(t("avatarUpdated"))
        } catch (error) {
            console.error("Avatar upload failed:", error)
            toast.error(t("avatarUploadFailed"))
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
            toast.success(t("avatarRemoved"))
        } catch (error) {
            console.error("Avatar remove failed:", error)
            toast.error(t("avatarRemoveFailed"))
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
                    placeholder={t("namePlaceholder")}
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
                        {tVal("requiredLengthRange", {
                            min: MIN_DISPLAY_NAME_LENGTH,
                            max: MAX_USER_NAME_LENGTH,
                        })}
                    </p>
                )}
            </div>
        </Field>
    )
}

export function ProfileSettingsPanel() {
    const t = useDebugTranslations("settings.profilePanel")
    const tCommon = useDebugTranslations("common.actions")
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

    const deleteConfirmationTarget = user.email ?? t("deleteAccountFallback")
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
            throw new Error(t("authUserMissing"))
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
                toast.error(t("deleteAccountFailed"))
                return
            }

            await supabase.auth.signOut()
            setUser(null)
            setMyCalendars([])
            clearActiveCalendarContext()
            closeSettings()
            setDeleteConfirmation("")
            setIsDeleteDialogOpen(false)
            toast.success(t("deleteAccountSuccess"))
            router.replace("/signin")
            router.refresh()
        } catch (error) {
            console.error("Failed to delete account:", error)
            toast.error(t("deleteAccountFailed"))
        } finally {
            setIsDeletingAccount(false)
        }
    }

    return (
        <div>
            <FieldGroup>
                <FieldSet>
                    <FieldLegend className="mb-4 font-semibold">
                        {t("accountSection")}
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
                        {t("securitySection")}
                    </FieldLegend>
                    <FieldGroup>
                        <Field
                            orientation="horizontal"
                            className="items-center!"
                        >
                            <FieldContent>
                                <FieldLabel htmlFor="switch-focus-mode">
                                    {t("emailLabel")}
                                </FieldLabel>
                                <FieldDescription>
                                    example@gmail.com
                                </FieldDescription>
                            </FieldContent>
                            <Button variant="outline">
                                {t("manageEmail")}
                            </Button>
                        </Field>
                        <Field
                            orientation="horizontal"
                            className="items-center!"
                        >
                            <FieldContent>
                                <FieldLabel htmlFor="switch-focus-mode">
                                    {t("passwordLabel")}
                                </FieldLabel>
                                <FieldDescription>
                                    {t("passwordDescription")}
                                </FieldDescription>
                            </FieldContent>
                            <Button variant="outline">
                                {t("setPassword")}
                            </Button>
                        </Field>
                        <Field
                            orientation="horizontal"
                            className="items-center!"
                        >
                            <FieldContent>
                                <FieldLabel htmlFor="switch-focus-mode">
                                    {t("mfaLabel")}
                                </FieldLabel>
                                <FieldDescription>
                                    {t("mfaDescription")}
                                </FieldDescription>
                            </FieldContent>
                            <Button variant="outline">
                                {t("addAuthMethod")}
                            </Button>
                        </Field>
                    </FieldGroup>
                </FieldSet>
                <FieldSeparator />
                <FieldSet>
                    <FieldLegend className="mb-4 font-semibold">
                        {t("supportSection")}
                    </FieldLegend>
                    <FieldGroup>
                        <Field
                            orientation="horizontal"
                            className="items-center!"
                        >
                            <FieldContent>
                                <FieldLabel htmlFor="switch-focus-mode">
                                    {t("deleteAccountLabel")}
                                </FieldLabel>
                                <FieldDescription>
                                    {t("deleteAccountDescription")}
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
                                        {t("deleteAccountLabel")}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent size="sm">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            {t("deleteAccountDialogTitle")}
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            {t(
                                                "deleteAccountDialogDescription"
                                            )}
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <div className="grid gap-2">
                                        <p className="text-sm text-muted-foreground">
                                            {t("deleteAccountConfirmPrefix")}{" "}
                                            <span className="font-medium text-foreground">
                                                {deleteConfirmationTarget}
                                            </span>{" "}
                                            {t("deleteAccountConfirmSuffix")}
                                        </p>
                                        <Input
                                            value={deleteConfirmation}
                                            onChange={(event) =>
                                                setDeleteConfirmation(
                                                    event.target.value
                                                )
                                            }
                                            placeholder={deleteConfirmationTarget}
                                            aria-label={t(
                                                "deleteAccountConfirmAria"
                                            )}
                                        />
                                    </div>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>
                                            {tCommon("cancel")}
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
                                                ? t("deleting")
                                                : t("deleteAccountLabel")}
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
