"use client"

/**
 * GoogleCalendarSubscribeDialog
 *
 * 진입: CalendarSubscriptionManager 사이드바 + 버튼 → 구독 검색 다이얼로그 탭
 * 흐름:
 *   1. 연결된 Google 계정 목록 표시 or 새 계정 연동 (OAuth popup)
 *   2. 계정 선택 → 해당 계정의 Google 캘린더 목록 로드
 *   3. 캘린더 선택 → /api/google-calendar/subscribe 호출
 *   4. 완료 후 콜백 (사이드바 갱신)
 */

import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import {
    ResponsiveModal,
    ResponsiveModalContent,
} from "@/components/responsive-modal"
import {
    useGoogleIntegrations,
    type GoogleIntegration,
} from "@/hooks/use-google-integrations"
import {
    calendarCollectionColorLabels,
    calendarCollectionColors,
    getCalendarCollectionPaletteClassName,
    isCalendarCollectionColor,
    type CalendarCollectionColor,
} from "@/lib/calendar/collection-color"
import { useCalendarStore } from "@/store/useCalendarStore"
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
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { DialogClose, DialogFooter } from "@workspace/ui/components/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@workspace/ui/components/input-group"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import {
    CheckIcon,
    GlobeIcon,
    MoreHorizontalIcon,
    PlusIcon,
    RefreshCwIcon,
    UnlinkIcon,
} from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type GoogleCalendarEntry = {
    id: string
    summary: string
    description?: string
    accessRole: string
    backgroundColor?: string
    primary?: boolean
    timeZone?: string
}

function getGoogleCalendarDefaultCollectionName(
    calendarEntry: GoogleCalendarEntry,
    integration?: GoogleIntegration
) {
    if (calendarEntry.primary && integration) {
        return integration.googleEmail
    }

    return calendarEntry.summary
}

export type GoogleCalendarSubscribeDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSubscribed?: (catalogId: string) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Google OAuth popup helper
// ─────────────────────────────────────────────────────────────────────────────

async function openGoogleAuthPopup(forceSelect = false): Promise<{
    email: string
    accountId: string
} | null> {
    const res = await fetch(
        `/api/google-calendar/auth${forceSelect ? "?forceAccountSelect=true" : ""}`
    )
    if (!res.ok) return null

    const { url } = (await res.json()) as { url: string }

    return new Promise((resolve) => {
        const popupWidth = 520
        const popupHeight = 620
        const left = Math.max(
            0,
            window.screenX + (window.outerWidth - popupWidth) / 2
        )
        const top = Math.max(
            0,
            window.screenY + (window.outerHeight - popupHeight) / 2
        )

        const popup = window.open(
            url,
            "google-calendar-auth",
            `width=${popupWidth},height=${popupHeight},left=${Math.round(left)},top=${Math.round(top)}`
        )

        if (!popup) {
            toast.error(
                "팝업이 차단되었습니다. 팝업을 허용한 후 다시 시도해주세요."
            )
            resolve(null)
            return
        }

        const handler = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return

            const msg = event.data as {
                type?: string
                email?: string
                accountId?: string
                message?: string
            }

            if (msg.type === "google-calendar-auth-success") {
                window.removeEventListener("message", handler)
                resolve({ email: msg.email!, accountId: msg.accountId! })
            } else if (msg.type === "google-calendar-auth-error") {
                window.removeEventListener("message", handler)
                toast.error(msg.message ?? "Google 인증에 실패했습니다.")
                resolve(null)
            }
        }

        window.addEventListener("message", handler)

        // 팝업 강제 닫힘 감지
        const checkClosed = setInterval(() => {
            if (popup.closed) {
                clearInterval(checkClosed)
                window.removeEventListener("message", handler)
                resolve(null)
            }
        }, 500)
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// AccountRow
// ─────────────────────────────────────────────────────────────────────────────

function AccountRow({
    integration,
    isSelected,
    onClick,
    onDisconnect,
    isDisconnecting,
    disconnectLabel,
}: {
    integration: GoogleIntegration
    isSelected: boolean
    onClick: () => void
    onDisconnect: () => void
    isDisconnecting: boolean
    disconnectLabel: string
}) {
    const initial = (integration.googleDisplayName ?? integration.googleEmail)
        .trim()
        .charAt(0)
        .toUpperCase()

    return (
        <div
            className={cn(
                "flex w-full items-center gap-1 rounded-lg border px-1 py-1 transition-colors",
                isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
            )}
        >
            <button
                type="button"
                onClick={onClick}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-1.5 text-left"
                disabled={isDisconnecting}
            >
                <Avatar className="size-7 rounded-full">
                    <AvatarFallback className="rounded-full bg-muted text-xs text-muted-foreground">
                        {initial}
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                    {integration.googleDisplayName && (
                        <p className="truncate text-sm leading-tight font-medium">
                            {integration.googleDisplayName}
                        </p>
                    )}
                    <p className="truncate text-xs text-muted-foreground">
                        {integration.googleEmail}
                    </p>
                </div>
                {isSelected && (
                    <CheckIcon className="size-4 shrink-0 text-primary" />
                )}
            </button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-muted-foreground"
                        disabled={isDisconnecting}
                        aria-label="account actions"
                    >
                        {isDisconnecting ? (
                            <Spinner className="size-4" />
                        ) : (
                            <MoreHorizontalIcon className="size-4" />
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                        onSelect={(event) => {
                            event.preventDefault()
                            onDisconnect()
                        }}
                        className="text-destructive focus:text-destructive"
                    >
                        <UnlinkIcon className="size-4" />
                        <span>{disconnectLabel}</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Form
// ─────────────────────────────────────────────────────────────────────────────

export function GoogleCalendarSubscribeForm({
    onSubscribed,
    onClose,
}: {
    onSubscribed?: (catalogId: string) => void
    onClose: () => void
}) {
    const t = useDebugTranslations("calendar.googleCalendarSubscribe")
    const tCommon = useDebugTranslations("common.actions")
    const activeCalendarId = useCalendarStore((s) => s.activeCalendar?.id)
    const subscriptionCatalogs = useCalendarStore((s) => s.subscriptionCatalogs)
    const installedSubscriptionIds = useCalendarStore(
        (s) => s.subscriptionState.installedSubscriptionIds
    )

    const {
        integrations,
        isLoading: isLoadingIntegrations,
        reload: reloadIntegrations,
    } = useGoogleIntegrations()

    const [selectedAccountId, setSelectedAccountId] = React.useState<string>("")
    const [isConnecting, setIsConnecting] = React.useState(false)

    const [googleCalendars, setGoogleCalendars] = React.useState<
        GoogleCalendarEntry[]
    >([])
    const [isLoadingCalendars, setIsLoadingCalendars] = React.useState(false)
    const [selectedCalendarId, setSelectedCalendarId] =
        React.useState<string>("")
    const [collectionName, setCollectionName] = React.useState("")

    const [selectedColor, setSelectedColor] =
        React.useState<CalendarCollectionColor>("blue")

    const [isSubscribing, setIsSubscribing] = React.useState(false)
    const [disconnectingAccountId, setDisconnectingAccountId] = React.useState<
        string | null
    >(null)
    const [pendingDisconnectAccount, setPendingDisconnectAccount] =
        React.useState<GoogleIntegration | null>(null)

    const installedGoogleCalendarKeys = React.useMemo(() => {
        const installedSet = new Set(installedSubscriptionIds)

        return new Set(
            subscriptionCatalogs
                .filter((catalog) => installedSet.has(catalog.id))
                .map((catalog) => {
                    const googleCalendarId = String(
                        catalog.config?.googleCalendarId ?? ""
                    )
                    const googleAccountId = String(
                        catalog.config?.googleAccountId ?? ""
                    )

                    return googleCalendarId && googleAccountId
                        ? `${googleAccountId}::${googleCalendarId}`
                        : ""
                })
                .filter(Boolean)
        )
    }, [installedSubscriptionIds, subscriptionCatalogs])

    const isCalendarAlreadyInstalled = React.useCallback(
        (accountId: string, calendarId: string) =>
            installedGoogleCalendarKeys.has(`${accountId}::${calendarId}`),
        [installedGoogleCalendarKeys]
    )

    // 계정 선택 시 캘린더 목록 로드
    React.useEffect(() => {
        if (!selectedAccountId) {
            setGoogleCalendars([])
            setSelectedCalendarId("")
            setCollectionName("")
            return
        }

        setIsLoadingCalendars(true)
        setGoogleCalendars([])
        setSelectedCalendarId("")

        fetch(
            `/api/google-calendar/list?accountId=${encodeURIComponent(selectedAccountId)}`
        )
            .then(async (r) => {
                const data = (await r.json()) as {
                    calendars?: GoogleCalendarEntry[]
                    error?: string
                    message?: string
                }
                if (!r.ok) {
                    throw data
                }
                return data
            })
            .then(
                (data: {
                    calendars?: GoogleCalendarEntry[]
                    error?: string
                    message?: string
                }) => {
                    if (data.error) {
                        if (data.error === "google_insufficient_scope") {
                            toast.error(t("insufficientPermission"))
                            return
                        }
                        toast.error(data.message ?? t("loadCalendarsFailed"))
                        return
                    }
                    const calendars = data.calendars ?? []
                    setGoogleCalendars(calendars)
                    // 이미 추가된 캘린더는 제외하고 primary를 우선 선택
                    const primary = calendars.find(
                        (c) =>
                            c.primary &&
                            !isCalendarAlreadyInstalled(selectedAccountId, c.id)
                    )
                    const firstAvailable = calendars.find(
                        (c) =>
                            !isCalendarAlreadyInstalled(selectedAccountId, c.id)
                    )
                    setSelectedCalendarId(
                        primary?.id ?? firstAvailable?.id ?? ""
                    )
                }
            )
            .catch(
                (error: { error?: string; message?: string } | undefined) => {
                    if (error?.error === "google_insufficient_scope") {
                        toast.error(t("insufficientPermission"))
                        return
                    }
                    toast.error(error?.message ?? t("loadCalendarsFailed"))
                }
            )
            .finally(() => setIsLoadingCalendars(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCalendarAlreadyInstalled, selectedAccountId])

    React.useEffect(() => {
        if (!selectedAccountId || !selectedCalendarId) {
            setCollectionName("")
            return
        }

        const calendarEntry = googleCalendars.find(
            (calendar) => calendar.id === selectedCalendarId
        )
        if (!calendarEntry) {
            setCollectionName("")
            return
        }

        const selectedIntegration = integrations.find(
            (integration) => integration.googleAccountId === selectedAccountId
        )
        setCollectionName(
            getGoogleCalendarDefaultCollectionName(
                calendarEntry,
                selectedIntegration
            )
        )
    }, [googleCalendars, integrations, selectedAccountId, selectedCalendarId])

    // 새 Google 계정 연결
    const handleConnectAccount = async () => {
        setIsConnecting(true)
        try {
            const result = await openGoogleAuthPopup(integrations.length > 0)
            if (result) {
                await reloadIntegrations()
                setSelectedAccountId(result.accountId)
                toast.success(t("accountConnected", { email: result.email }))
            }
        } finally {
            setIsConnecting(false)
        }
    }

    // 구독 등록
    const handleSubscribe = async () => {
        if (!selectedAccountId || !selectedCalendarId || !activeCalendarId)
            return

        const calendarEntry = googleCalendars.find(
            (c) => c.id === selectedCalendarId
        )
        if (!calendarEntry) return

        // primary 캘린더는 summary가 "google" 등 의미없는 값일 수 있어 이메일로 대체
        const selectedIntegration = integrations.find(
            (i) => i.googleAccountId === selectedAccountId
        )
        const googleCalendarName = getGoogleCalendarDefaultCollectionName(
            calendarEntry,
            selectedIntegration
        )
        const trimmedCollectionName = collectionName.trim()
        const nextCollectionName = trimmedCollectionName || googleCalendarName

        setIsSubscribing(true)
        try {
            const res = await fetch("/api/google-calendar/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    calendarId: activeCalendarId,
                    googleAccountId: selectedAccountId,
                    googleCalendarId: selectedCalendarId,
                    googleCalendarTimeZone: calendarEntry.timeZone,
                    googleCalendarName,
                    collectionName: nextCollectionName,
                    collectionColor: selectedColor,
                }),
            })

            if (!res.ok) {
                throw new Error("subscribe failed")
            }

            const { catalogId } = (await res.json()) as { catalogId: string }

            toast.success(t("subscribeSuccess", { name: nextCollectionName }))
            onSubscribed?.(catalogId)
            onClose()
        } catch {
            toast.error(t("subscribeFailed"))
        } finally {
            setIsSubscribing(false)
        }
    }

    const handleDisconnectAccount = async (accountId: string) => {
        setDisconnectingAccountId(accountId)
        try {
            const response = await fetch("/api/google-calendar/integration", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accountId }),
            })

            if (!response.ok) {
                throw new Error("disconnect_failed")
            }

            if (selectedAccountId === accountId) {
                setSelectedAccountId("")
                setGoogleCalendars([])
                setSelectedCalendarId("")
            }

            await reloadIntegrations()
            toast.success(t("disconnectSuccess"))
        } catch {
            toast.error(t("disconnectFailed"))
        } finally {
            setDisconnectingAccountId(null)
        }
    }

    const isBusy = isConnecting || isLoadingCalendars || isSubscribing
    const isSelectedCalendarAlreadyInstalled =
        !!selectedAccountId &&
        !!selectedCalendarId &&
        isCalendarAlreadyInstalled(selectedAccountId, selectedCalendarId)
    const hasAvailableGoogleCalendar =
        !!selectedAccountId &&
        googleCalendars.some(
            (calendar) =>
                !isCalendarAlreadyInstalled(selectedAccountId, calendar.id)
        )
    const canSubscribe =
        !!selectedAccountId &&
        !!selectedCalendarId &&
        !!collectionName.trim() &&
        !isSelectedCalendarAlreadyInstalled &&
        !isBusy

    return (
        <>
            <div className="flex w-full flex-col gap-5">
                {/* Google 계정 섹션 */}
                <Field>
                    <FieldLabel>{t("accountLabel")}</FieldLabel>
                    <div className="flex flex-col gap-2">
                        {isLoadingIntegrations ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Spinner className="size-4" />
                                {t("loadingAccounts")}
                            </div>
                        ) : integrations.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                {t("noAccounts")}
                            </p>
                        ) : (
                            integrations.map((integration) => (
                                <AccountRow
                                    key={integration.googleAccountId}
                                    integration={integration}
                                    isSelected={
                                        selectedAccountId ===
                                        integration.googleAccountId
                                    }
                                    onClick={() =>
                                        setSelectedAccountId(
                                            integration.googleAccountId
                                        )
                                    }
                                    onDisconnect={() =>
                                        setPendingDisconnectAccount(integration)
                                    }
                                    isDisconnecting={
                                        disconnectingAccountId ===
                                        integration.googleAccountId
                                    }
                                    disconnectLabel={t("disconnect")}
                                />
                            ))
                        )}

                        <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-start gap-1"
                            onClick={handleConnectAccount}
                            disabled={isBusy}
                        >
                            {isConnecting ? (
                                <Spinner className="size-4" />
                            ) : (
                                <PlusIcon className="size-4" />
                            )}
                            {integrations.length > 0
                                ? t("addAnotherAccount")
                                : t("connectAccount")}
                        </Button>
                    </div>
                </Field>

                {/* 캘린더 선택 */}
                {selectedAccountId && (
                    <Field>
                        <div className="flex items-center justify-between">
                            <FieldLabel>{t("calendarLabel")}</FieldLabel>
                            {selectedAccountId && !isLoadingCalendars && (
                                <button
                                    type="button"
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                        // 목록 새로고침
                                        const prev = selectedAccountId
                                        setSelectedAccountId("")
                                        setTimeout(
                                            () => setSelectedAccountId(prev),
                                            0
                                        )
                                    }}
                                >
                                    <RefreshCwIcon className="size-3" />
                                    {t("refresh")}
                                </button>
                            )}
                        </div>

                        {isLoadingCalendars ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Spinner className="size-4" />
                                {t("loadingCalendars")}
                            </div>
                        ) : googleCalendars.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                {t("noCalendars")}
                            </p>
                        ) : (
                            <Select
                                value={selectedCalendarId}
                                onValueChange={setSelectedCalendarId}
                                disabled={isBusy}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue
                                        placeholder={t("calendarPlaceholder")}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {googleCalendars.map((cal) => {
                                            const isInstalled =
                                                isCalendarAlreadyInstalled(
                                                    selectedAccountId,
                                                    cal.id
                                                )

                                            return (
                                                <SelectItem
                                                    key={cal.id}
                                                    value={cal.id}
                                                    className="py-2"
                                                    disabled={isInstalled}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {cal.backgroundColor && (
                                                            <span
                                                                className="inline-block size-2.5 shrink-0 rounded-full"
                                                                style={{
                                                                    backgroundColor:
                                                                        cal.backgroundColor,
                                                                }}
                                                            />
                                                        )}
                                                        <span className="truncate text-sm">
                                                            {cal.summary}
                                                            {cal.primary && (
                                                                <span className="ml-1.5 text-xs text-muted-foreground">
                                                                    (
                                                                    {t(
                                                                        "primaryCalendar"
                                                                    )}
                                                                    )
                                                                </span>
                                                            )}
                                                            {isInstalled && (
                                                                <span className="ml-1.5 text-xs text-muted-foreground">
                                                                    (
                                                                    {t(
                                                                        "alreadyAddedBadge"
                                                                    )}
                                                                    )
                                                                </span>
                                                            )}
                                                        </span>
                                                    </div>
                                                </SelectItem>
                                            )
                                        })}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        )}
                    </Field>
                )}

                {selectedAccountId && !isLoadingCalendars && (
                    <Field>
                        <FieldLabel htmlFor="google-calendar-collection-name">
                            {t("collectionNameLabel")}
                        </FieldLabel>
                        <InputGroup>
                            <InputGroupAddon align="inline-start">
                                <Select
                                    value={selectedColor}
                                    onValueChange={(value) => {
                                        if (isCalendarCollectionColor(value)) {
                                            setSelectedColor(value)
                                        }
                                    }}
                                    disabled={isBusy || !selectedCalendarId}
                                >
                                    <SelectTrigger className="h-auto! w-13 border-0 px-1 py-0! hover:bg-muted">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {calendarCollectionColors.map(
                                            (color) => (
                                                <SelectItem
                                                    key={color}
                                                    value={color}
                                                >
                                                    <span className="flex cursor-pointer items-center gap-1.75 px-0.5 py-0.5">
                                                        <span
                                                            className={cn(
                                                                "inline-flex size-4.5 items-center gap-1.5 rounded-sm",
                                                                getCalendarCollectionPaletteClassName(
                                                                    color
                                                                )
                                                            )}
                                                        ></span>
                                                        <span>
                                                            {
                                                                calendarCollectionColorLabels[
                                                                    color
                                                                ]
                                                            }
                                                        </span>
                                                    </span>
                                                </SelectItem>
                                            )
                                        )}
                                    </SelectContent>
                                </Select>
                            </InputGroupAddon>
                            <InputGroupInput
                                id="google-calendar-collection-name"
                                value={collectionName}
                                onChange={(event) =>
                                    setCollectionName(event.target.value)
                                }
                                placeholder={t("collectionNamePlaceholder")}
                                disabled={isBusy || !selectedCalendarId}
                                maxLength={80}
                            />
                        </InputGroup>
                    </Field>
                )}

                {isSelectedCalendarAlreadyInstalled && (
                    <p className="text-xs text-muted-foreground">
                        {t("alreadyAddedDescription")}
                    </p>
                )}

                {selectedAccountId &&
                    !isLoadingCalendars &&
                    googleCalendars.length > 0 &&
                    !hasAvailableGoogleCalendar && (
                        <p className="text-xs text-muted-foreground">
                            {t("allCalendarsAlreadyAdded")}
                        </p>
                    )}

                {/* 안내 문구 */}
                <p className="text-xs text-muted-foreground">
                    {t("description")}
                </p>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline" className="flex-1">
                            {tCommon("close")}
                        </Button>
                    </DialogClose>
                    <Button
                        onClick={handleSubscribe}
                        disabled={!canSubscribe}
                        className="flex-1"
                    >
                        {isSubscribing && <Spinner className="size-4" />}
                        {t("submit")}
                    </Button>
                </DialogFooter>
            </div>

            <AlertDialog
                open={Boolean(pendingDisconnectAccount)}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingDisconnectAccount(null)
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("disconnect")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("disconnectConfirm")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            {tCommon("close")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(event) => {
                                event.preventDefault()
                                if (!pendingDisconnectAccount) return
                                void handleDisconnectAccount(
                                    pendingDisconnectAccount.googleAccountId
                                )
                                setPendingDisconnectAccount(null)
                            }}
                        >
                            {t("disconnect")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Public component
// ─────────────────────────────────────────────────────────────────────────────

export function GoogleCalendarSubscribeDialog({
    open,
    onOpenChange,
    onSubscribed,
}: GoogleCalendarSubscribeDialogProps) {
    const t = useDebugTranslations("calendar.googleCalendarSubscribe")

    return (
        <ResponsiveModal open={open} onOpenChange={onOpenChange}>
            <ResponsiveModalContent
                title={
                    <span className="flex items-center gap-2">
                        <GlobeIcon className="size-4 text-muted-foreground" />
                        {t("dialogTitle")}
                    </span>
                }
                description={t("dialogDescription")}
                maxWidth="sm:max-w-sm"
            >
                <GoogleCalendarSubscribeForm
                    onSubscribed={onSubscribed}
                    onClose={() => onOpenChange(false)}
                />
            </ResponsiveModalContent>
        </ResponsiveModal>
    )
}
