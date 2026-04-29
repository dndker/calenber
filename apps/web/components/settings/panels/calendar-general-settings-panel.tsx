"use client"

import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { useSettingsModal } from "@/components/settings/settings-modal-provider"
import { AvatarUploadControl } from "@/components/settings/shared/avatar-upload-control"
import { NameInputControl } from "@/components/settings/shared/name-input-control"
import { useCalendarEventLayout } from "@/hooks/use-calendar-event-layout"
import { compressAvatarImage, validateAvatarImage } from "@/lib/avatar-image"
import {
    normalizeCalendarLayoutOptions,
    type CalendarWeekStartsOn,
} from "@/lib/calendar/layout-options"
import { deleteOwnedCalendar, leaveCalendar } from "@/lib/calendar/mutations"
import {
    canManageCalendar,
    canViewCalendarSettings,
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

function CalendarGeneralCalendarNameField({
    calendarId,
    serverName,
    isDemoCalendar,
    canManageSettings,
}: {
    calendarId: string
    serverName: string
    isDemoCalendar: boolean
    canManageSettings: boolean
}) {
    const t = useDebugTranslations("settings.calendarGeneral")
    const tForm = useDebugTranslations("common.form")
    const activeCalendarMembership = useCalendarStore(
        (s) => s.activeCalendarMembership
    )
    const updateCalendarSnapshot = useCalendarStore(
        (s) => s.updateCalendarSnapshot
    )
    const [calendarName, setCalendarName] = useState(serverName)
    const [isSavingName, setIsSavingName] = useState(false)

    const trimmedCalendarName = calendarName.trim()
    const hasCalendarNameLengthError =
        trimmedCalendarName.length < MIN_DISPLAY_NAME_LENGTH ||
        trimmedCalendarName.length > MAX_CALENDAR_NAME_LENGTH

    useEffect(() => {
        if (isDemoCalendar || !canManageCalendar(activeCalendarMembership)) {
            return
        }

        const nextName = trimmedCalendarName
        const currentName = serverName.trim()

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
                    .eq("id", calendarId)

                if (error) {
                    throw error
                }

                updateCalendarSnapshot(calendarId, { name: nextName })
            } catch (error) {
                console.error("Failed to update calendar name:", error)
                toast.error(t("calendarNameSaveFailed"))
            } finally {
                setIsSavingName(false)
            }
        }, 500)

        return () => window.clearTimeout(timeout)
    }, [
        activeCalendarMembership,
        calendarId,
        isDemoCalendar,
        serverName,
        trimmedCalendarName,
        updateCalendarSnapshot,
        t,
    ])

    return (
        <Field>
            <FieldContent>
                <FieldLabel>{t("calendarNameLabel")}</FieldLabel>
            </FieldContent>

            <NameInputControl
                value={calendarName}
                placeholder={t("calendarNamePlaceholder")}
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
                    {tForm("requiredLengthRange", {
                        min: MIN_DISPLAY_NAME_LENGTH,
                        max: MAX_CALENDAR_NAME_LENGTH,
                    })}
                </p>
            )}
        </Field>
    )
}

export function CalendarGeneralSettingsPanel() {
    const router = useRouter()
    const { closeSettings } = useSettingsModal()
    const t = useDebugTranslations("settings.calendarGeneral")
    const tVal = useDebugTranslations("common.validation")
    const tCommon = useDebugTranslations("common.actions")
    const tCommonStatus = useDebugTranslations("common.status")
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

    const [isSavingSecurity, setIsSavingSecurity] = useState(false)
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
    const [isRemovingAvatar, setIsRemovingAvatar] = useState(false)
    const [ownerCount, setOwnerCount] = useState(0)
    const [isLeavingCalendar, setIsLeavingCalendar] = useState(false)
    const [isDeletingCalendar, setIsDeletingCalendar] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [deleteConfirmation, setDeleteConfirmation] = useState("")

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

    const layoutOptions = normalizeCalendarLayoutOptions(
        activeCalendar?.layoutOptions
    )
    const layoutSaveQueueRef = useRef<ReturnType<
        typeof normalizeCalendarLayoutOptions
    > | null>(null)
    const persistedLayoutOptionsRef = useRef(layoutOptions)
    const isLayoutSaveInFlightRef = useRef(false)

    useEffect(() => {
        persistedLayoutOptionsRef.current = normalizeCalendarLayoutOptions(
            activeCalendar?.layoutOptions
        )
    }, [activeCalendar?.layoutOptions])

    if (!activeCalendar) {
        return (
            <div className="text-sm text-muted-foreground">
                {t("selectCalendarToEdit")}
            </div>
        )
    }

    if (!canViewCalendarSettings(activeCalendarMembership)) {
        return (
            <div className="text-sm text-muted-foreground">
                {t("membersOnlyView")}
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
                toast.error(t("leaveCalendarFailed"))
                return
            }

            setMyCalendars(
                myCalendars.filter(
                    (calendar) => calendar.id !== activeCalendar.id
                )
            )
            clearActiveCalendarContext()
            closeSettings()
            toast.success(t("leaveCalendarSuccess"))
            router.push("/calendar")
            router.refresh()
        } catch (error) {
            console.error("Failed to leave calendar:", error)
            toast.error(t("leaveCalendarFailed"))
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

            const deleteResult = await deleteOwnedCalendar(
                supabase,
                activeCalendar.id
            )

            if (deleteResult !== true) {
                toast.error(
                    deleteResult === "You must keep at least one owned calendar"
                        ? t("deleteCalendarMustKeepOne")
                        : t("deleteCalendarFailed")
                )
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
            toast.success(t("deleteCalendarSuccess"))
            router.push("/calendar")
            router.refresh()
        } catch (error) {
            console.error("Failed to delete calendar:", error)
            toast.error(t("deleteCalendarFailed"))
        } finally {
            setIsDeletingCalendar(false)
        }
    }

    const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]

        if (!file || !canManageSettings) {
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
            toast.success(t("avatarUpdateSuccess"))
        } catch (error) {
            console.error("Calendar avatar upload failed:", error)
            toast.error(t("avatarUploadFailed"))
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
            toast.success(t("avatarRemoveSuccess"))
        } catch (error) {
            console.error("Calendar avatar remove failed:", error)
            toast.error(t("avatarRemoveFailed"))
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
            toast.success(t("accessModeUpdateSuccess"))
        } catch (error) {
            console.error("Failed to update calendar access mode:", error)
            toast.error(t("accessModeSaveFailed"))
        } finally {
            setIsSavingSecurity(false)
        }
    }

    const saveLayoutOptions = async (
        patch: Partial<ReturnType<typeof normalizeCalendarLayoutOptions>>
    ) => {
        if (!canManageSettings) {
            toast.error(t("layoutChangePermissionDenied"))
            return
        }

        const previousOptions = normalizeCalendarLayoutOptions(
            activeCalendar.layoutOptions
        )
        const nextOptions = normalizeCalendarLayoutOptions({
            ...previousOptions,
            ...patch,
        })

        if (JSON.stringify(previousOptions) === JSON.stringify(nextOptions)) {
            return
        }

        updateCalendarSnapshot(activeCalendar.id, {
            layoutOptions: nextOptions,
        })
        layoutSaveQueueRef.current = nextOptions

        if (isLayoutSaveInFlightRef.current) {
            return
        }

        isLayoutSaveInFlightRef.current = true

        while (layoutSaveQueueRef.current) {
            const targetOptions = layoutSaveQueueRef.current
            layoutSaveQueueRef.current = null

            try {
                const supabase = createBrowserSupabase()
                const { error } = await supabase
                    .from("calendars")
                    .update({ layout_options: targetOptions })
                    .eq("id", activeCalendar.id)

                if (error) {
                    throw error
                }

                persistedLayoutOptionsRef.current = targetOptions
            } catch (error) {
                updateCalendarSnapshot(activeCalendar.id, {
                    layoutOptions: persistedLayoutOptionsRef.current,
                })
                layoutSaveQueueRef.current = null
                console.error(
                    "Failed to update calendar layout options:",
                    error
                )
                toast.error(t("layoutPersistFailed"))
                break
            }
        }

        isLayoutSaveInFlightRef.current = false
    }

    return (
        <FieldGroup>
            <FieldSet>
                <FieldLegend className="mb-4 font-semibold">
                    {t("calendarSettingsSection")}
                </FieldLegend>
                <FieldGroup>
                    {!canManageSettings && (
                        <p className="text-sm text-muted-foreground">
                            {t("onlyManagersCanChangeSettings")}
                        </p>
                    )}
                    <CalendarGeneralCalendarNameField
                        key={activeCalendar.id}
                        calendarId={activeCalendar.id}
                        serverName={activeCalendar.name}
                        isDemoCalendar={isDemoCalendar}
                        canManageSettings={canManageSettings}
                    />
                    <Field>
                        <FieldContent>
                            <FieldLabel>{t("calendarImageLabel")}</FieldLabel>
                            <FieldDescription>
                                {t("calendarImageDescription")}
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
                            <FieldLabel>{t("securityLabel")}</FieldLabel>
                            <FieldDescription>
                                {t("securityDescription")}
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
                                <SelectValue placeholder={t("securityLabel")} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>
                                        {t("securityGroupLabel")}
                                    </SelectLabel>
                                    <SelectItem value="public_open">
                                        {t("accessPublicOpen")}
                                    </SelectItem>
                                    <SelectItem value="public_approval">
                                        {t("accessPublicApproval")}
                                    </SelectItem>
                                    <SelectItem value="private">
                                        {t("accessPrivate")}
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
                    {t("layoutSection")}
                </FieldLegend>
                <FieldGroup>
                    <Field orientation="horizontal" className="items-center!">
                        <FieldContent>
                            <FieldLabel>{t("weekStartsOnLabel")}</FieldLabel>
                            <FieldDescription>
                                {t("weekStartsOnDescription")}
                            </FieldDescription>
                        </FieldContent>

                        <Select
                            value={layoutOptions.weekStartsOn}
                            onValueChange={(value) => {
                                if (value === "sunday" || value === "monday") {
                                    void saveLayoutOptions({
                                        weekStartsOn:
                                            value as CalendarWeekStartsOn,
                                    })
                                }
                            }}
                            disabled={!canManageSettings}
                        >
                            <SelectTrigger className="w-auto">
                                <SelectValue
                                    placeholder={t("weekStartsOnLabel")}
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>
                                        {t("weekStartsOnGroupLabel")}
                                    </SelectLabel>
                                    <SelectItem value="sunday">
                                        {t("weekRowSunday")}
                                    </SelectItem>
                                    <SelectItem value="monday">
                                        {t("weekRowMonday")}
                                    </SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field orientation="horizontal" className="items-center!">
                        <FieldContent>
                            <FieldLabel>{t("hideWeekendLabel")}</FieldLabel>
                            <FieldDescription>
                                {t("hideWeekendDescription")}
                            </FieldDescription>
                        </FieldContent>

                        <Select
                            value={
                                layoutOptions.hideWeekendColumns
                                    ? "enabled"
                                    : "disabled"
                            }
                            onValueChange={(value) => {
                                if (
                                    value === "enabled" ||
                                    value === "disabled"
                                ) {
                                    void saveLayoutOptions({
                                        hideWeekendColumns: value === "enabled",
                                    })
                                }
                            }}
                            disabled={!canManageSettings}
                        >
                            <SelectTrigger className="w-full max-w-38">
                                <SelectValue
                                    placeholder={t("hideWeekendLabel")}
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>
                                        {t("hideWeekendGroupLabel")}
                                    </SelectLabel>
                                    <SelectItem value="disabled">
                                        {t("optionShow")}
                                    </SelectItem>
                                    <SelectItem value="enabled">
                                        {t("optionHide")}
                                    </SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field orientation="horizontal" className="items-center!">
                        <FieldContent>
                            <FieldLabel
                                className={
                                    layoutOptions.hideWeekendColumns
                                        ? "text-muted-foreground/50"
                                        : undefined
                                }
                            >
                                {t("weekendColorLabel")}
                            </FieldLabel>
                            <FieldDescription
                                className={
                                    layoutOptions.hideWeekendColumns
                                        ? "text-muted-foreground/50"
                                        : undefined
                                }
                            >
                                {t("weekendColorDescription")}
                            </FieldDescription>
                        </FieldContent>

                        <Select
                            value={
                                layoutOptions.showWeekendTextColors
                                    ? "enabled"
                                    : "disabled"
                            }
                            onValueChange={(value) => {
                                if (
                                    value === "enabled" ||
                                    value === "disabled"
                                ) {
                                    void saveLayoutOptions({
                                        showWeekendTextColors:
                                            value === "enabled",
                                    })
                                }
                            }}
                            disabled={
                                !canManageSettings ||
                                layoutOptions.hideWeekendColumns
                            }
                        >
                            <SelectTrigger className="w-full max-w-38">
                                <SelectValue
                                    placeholder={t("weekendColorLabel")}
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>
                                        {t("weekendColorGroupLabel")}
                                    </SelectLabel>
                                    <SelectItem value="enabled">
                                        {t("optionShow")}
                                    </SelectItem>
                                    <SelectItem value="disabled">
                                        {t("optionHide")}
                                    </SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field orientation="horizontal" className="items-center!">
                        <FieldContent>
                            <FieldLabel
                                className={
                                    layoutOptions.hideWeekendColumns
                                        ? "text-muted-foreground/50"
                                        : undefined
                                }
                            >
                                {t("weekendBackgroundLabel")}
                            </FieldLabel>
                            <FieldDescription
                                className={
                                    layoutOptions.hideWeekendColumns
                                        ? "text-muted-foreground/50"
                                        : undefined
                                }
                            >
                                {t("weekendBackgroundDescription")}
                            </FieldDescription>
                        </FieldContent>

                        <Select
                            value={
                                layoutOptions.showHolidayBackground
                                    ? "enabled"
                                    : "disabled"
                            }
                            onValueChange={(value) => {
                                if (
                                    value === "enabled" ||
                                    value === "disabled"
                                ) {
                                    void saveLayoutOptions({
                                        showHolidayBackground:
                                            value === "enabled",
                                    })
                                }
                            }}
                            disabled={
                                !canManageSettings ||
                                layoutOptions.hideWeekendColumns
                            }
                        >
                            <SelectTrigger className="w-full max-w-38">
                                <SelectValue
                                    placeholder={t(
                                        "backgroundEmphasisGroupLabel"
                                    )}
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>
                                        {t("backgroundEmphasisGroupLabel")}
                                    </SelectLabel>
                                    <SelectItem value="enabled">
                                        {t("optionShow")}
                                    </SelectItem>
                                    <SelectItem value="disabled">
                                        {t("optionHide")}
                                    </SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </Field>

                    <Field orientation="horizontal" className="items-center!">
                        <FieldContent>
                            <FieldLabel>{t("eventLayoutLabel")}</FieldLabel>
                            <FieldDescription>
                                {t("eventLayoutDescription", {
                                    name: activeCalendar.name,
                                })}
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
                                <SelectValue
                                    placeholder={t("eventLayoutPlaceholder")}
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>
                                        {t("eventLayoutGroupLabel")}
                                    </SelectLabel>
                                    <SelectItem value="compact">
                                        {t("layoutCompact")}
                                    </SelectItem>
                                    <SelectItem value="split">
                                        {t("layoutSplit")}
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
                    {t("dangerZone")}
                </FieldLegend>
                <FieldGroup>
                    {canLeaveCalendar && (
                        <Field
                            orientation="horizontal"
                            className="items-center!"
                        >
                            <FieldContent>
                                <FieldLabel>
                                    {t("leaveCalendarLabel")}
                                </FieldLabel>
                                <FieldDescription>
                                    {isOwner && ownerCount < 2
                                        ? t(
                                              "leaveCalendarOwnerBlockedDescription"
                                          )
                                        : t("leaveCalendarDescription")}
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
                                        {t("leaveCalendarLabel")}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent size="sm">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            {t("leaveCalendarDialogTitle")}
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            {t("leaveCalendarDialogBody")}
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>
                                            {tCommon("cancel")}
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            variant="destructive"
                                            disabled={isLeavingCalendar}
                                            onClick={() => {
                                                void handleLeaveCalendar()
                                            }}
                                        >
                                            {isLeavingCalendar
                                                ? tCommonStatus("processing")
                                                : t("leaveCalendarLabel")}
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
                                <FieldLabel>
                                    {t("deleteCalendarLabel")}
                                </FieldLabel>
                                <FieldDescription>
                                    {canDeleteLastCalendar
                                        ? t("deleteCalendarDescription")
                                        : t(
                                              "deleteLastCalendarBlockedDescription"
                                          )}
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
                                        {t("deleteCalendarLabel")}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent size="sm">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            {t("deleteCalendarDialogTitle")}
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            {t("deleteCalendarDialogBody")}
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <div className="grid gap-2">
                                        <p className="text-sm text-muted-foreground">
                                            {t("deleteConfirmPrompt", {
                                                name: deleteConfirmationTarget,
                                            })}
                                        </p>
                                        <Input
                                            value={deleteConfirmation}
                                            onChange={(event) =>
                                                setDeleteConfirmation(
                                                    event.target.value
                                                )
                                            }
                                            placeholder={
                                                deleteConfirmationTarget
                                            }
                                            aria-label={t(
                                                "deleteConfirmInputAria"
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
                                                !canDeleteLastCalendar ||
                                                isDeletingCalendar ||
                                                !isDeleteConfirmationMatched
                                            }
                                            onClick={() => {
                                                void handleDeleteCalendar()
                                            }}
                                        >
                                            {isDeletingCalendar
                                                ? tCommonStatus("deleting")
                                                : t("deleteCalendarLabel")}
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
