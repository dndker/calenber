"use client"

/**
 * CollectionSubscribeDialog — 공유된 컬렉션을 내 캘린더 중 하나에 구독하는 모달.
 *
 * 진입 경로:
 *   CalendarFilter 사이드바 컬렉션 항목의 "구독하기" 드롭다운 메뉴
 *
 * 동작:
 *   - 내가 owner/manager인 캘린더 목록을 셀렉트 박스로 보여줌
 *   - 소스 캘린더(공유 중인 캘린더)는 "공유중" disabled 표시
 *   - 이미 구독 설치된 캘린더는 "구독중" disabled 표시
 *   - 선택한 캘린더에 해당 컬렉션을 구독 설치
 */

import {
    ResponsiveModal,
    ResponsiveModalContent,
} from "@/components/responsive-modal"
import type { MyCalendarItem } from "@/lib/calendar/queries"
import { resolveSubscriptionCatalogIdForInstall } from "@/lib/calendar/resolve-subscription-catalog-id"
import { useCalendarStore } from "@/store/useCalendarStore"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { DialogClose, DialogFooter } from "@workspace/ui/components/dialog"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import * as React from "react"
import { toast } from "sonner"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CollectionSubscribeDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void

    /** 구독할 카탈로그 정보 */
    catalogId: string
    catalogName: string

    /**
     * 이 컬렉션을 소유한(공유 중인) 캘린더 ID.
     * 해당 캘린더는 목록에 "공유중" disabled로 표시된다.
     */
    sourceCalendarId?: string

    /** 구독 완료 후 콜백 */
    onSubscribed?: (calendarId: string) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// CalendarAvatarRow — 셀렉트 내부에서 아바타+이름+상태를 함께 표시
// ─────────────────────────────────────────────────────────────────────────────

function CalendarAvatarRow({
    calendar,
    showRole = false,
    isInstalled = false,
    isSource = false,
}: {
    calendar: MyCalendarItem
    showRole?: boolean
    isInstalled?: boolean
    /** 이 컬렉션을 공유 중인 소스 캘린더 여부 */
    isSource?: boolean
}) {
    const initial = calendar.name.trim().charAt(0).toUpperCase() || "?"
    const roleLabel =
        calendar.role === "owner"
            ? "소유자"
            : calendar.role === "manager"
              ? "관리자"
              : null

    const statusLabel = isSource ? "공유중" : isInstalled ? "구독중" : null

    return (
        <div className="flex items-center gap-2.5">
            <Avatar className="size-6 rounded-md after:rounded-md">
                <AvatarImage
                    src={calendar.avatarUrl ?? undefined}
                    alt={calendar.name}
                    className="rounded-md object-cover"
                />
                <AvatarFallback className="rounded-md bg-muted text-xs">
                    {initial}
                </AvatarFallback>
            </Avatar>
            <span className="flex-1 truncate text-sm">{calendar.name}</span>
            {statusLabel ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                    {statusLabel}
                </span>
            ) : (
                showRole &&
                roleLabel && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                        {roleLabel}
                    </span>
                )
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Form
// ─────────────────────────────────────────────────────────────────────────────

function CollectionSubscribeForm({
    catalogId,
    catalogName,
    managedCalendars,
    sourceCalendarId,
    onSubscribed,
    onClose,
}: {
    catalogId: string
    catalogName: string
    /** owner/manager 전체 캘린더 목록 (소스 캘린더 포함) */
    managedCalendars: MyCalendarItem[]
    sourceCalendarId?: string
    onSubscribed?: (calendarId: string) => void
    onClose: () => void
}) {
    // 이미 이 컬렉션이 설치된 캘린더 ID 집합 — 모달 마운트 시 DB 조회
    const [installedCalendarIdSet, setInstalledCalendarIdSet] = React.useState<
        Set<string>
    >(new Set())
    const [isLoadingInstalls, setIsLoadingInstalls] = React.useState(true)
    const [isSaving, setIsSaving] = React.useState(false)

    // 구독 가능한(소스·설치 제외) 캘린더 중 첫 번째를 초기 선택값으로 사용
    const firstAvailableId = React.useMemo(
        () =>
            managedCalendars.find(
                (c) =>
                    c.id !== sourceCalendarId &&
                    !installedCalendarIdSet.has(c.id)
            )?.id ?? "",
        [managedCalendars, sourceCalendarId, installedCalendarIdSet]
    )
    const [selectedCalendarId, setSelectedCalendarId] =
        React.useState<string>("")

    // 설치 현황 로드 후 초기 선택값 세팅
    React.useEffect(() => {
        if (isLoadingInstalls) return
        setSelectedCalendarId((prev) => prev || firstAvailableId)
    }, [isLoadingInstalls, firstAvailableId])

    // 해당 catalogId가 설치된 calendar_id 목록을 DB에서 조회
    React.useEffect(() => {
        if (managedCalendars.length === 0) {
            setIsLoadingInstalls(false)
            return
        }

        const supabase = createBrowserSupabase()
        const calendarIds = managedCalendars.map((c) => c.id)

        resolveSubscriptionCatalogIdForInstall(supabase, catalogId).then(
            async (catalogUuid) => {
                if (!catalogUuid) {
                    setIsLoadingInstalls(false)
                    return
                }

                const { data } = await supabase
                    .from("calendar_subscription_installs")
                    .select("calendar_id")
                    .eq("subscription_catalog_id", catalogUuid)
                    .in("calendar_id", calendarIds)

                setInstalledCalendarIdSet(
                    new Set(
                        (data ?? []).map(
                            (r: { calendar_id: string }) => r.calendar_id
                        )
                    )
                )
                setIsLoadingInstalls(false)
            }
        )
        // catalogId, managedCalendars 는 모달 마운트 시점에 고정 — 재조회 불필요
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleSubscribe = async () => {
        if (!selectedCalendarId) {
            toast.error("구독할 캘린더를 선택해 주세요.")
            return
        }

        if (selectedCalendarId === sourceCalendarId) {
            toast.error("이 컬렉션을 공유 중인 캘린더입니다.")
            return
        }

        if (installedCalendarIdSet.has(selectedCalendarId)) {
            toast.error("이미 구독된 캘린더입니다.")
            return
        }

        setIsSaving(true)
        const supabase = createBrowserSupabase()

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser()

            const catalogUuid = await resolveSubscriptionCatalogIdForInstall(
                supabase,
                catalogId
            )

            if (!catalogUuid) {
                toast.error("구독 정보를 찾을 수 없습니다.")
                return
            }

            const { error } = await supabase
                .from("calendar_subscription_installs")
                .upsert(
                    {
                        calendar_id: selectedCalendarId,
                        subscription_catalog_id: catalogUuid,
                        is_visible: true,
                        ...(user?.id ? { created_by: user.id } : {}),
                    },
                    { onConflict: "calendar_id,subscription_catalog_id" }
                )

            if (error) {
                throw error
            }

            onSubscribed?.(selectedCalendarId)
            toast.success(
                `내 캘린더에 '${catalogName}' 컬렉션이 추가되었습니다.`
            )
            onClose()
        } catch {
            toast.error("구독 중 오류가 발생했습니다. 다시 시도해 주세요.")
        } finally {
            setIsSaving(false)
        }
    }

    if (managedCalendars.length === 0) {
        return (
            <div className="flex flex-col gap-5">
                <p className="text-sm text-muted-foreground">
                    구독을 추가할 수 있는 캘린더가 없습니다.
                </p>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline" className="flex-1">
                            닫기
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </div>
        )
    }

    const isBusy = isLoadingInstalls || isSaving
    const isSelectedDisabled =
        !selectedCalendarId ||
        selectedCalendarId === sourceCalendarId ||
        installedCalendarIdSet.has(selectedCalendarId)

    return (
        <div className="flex flex-col gap-5">
            <Field>
                <FieldLabel>캘린더 선택</FieldLabel>
                <Select
                    value={selectedCalendarId}
                    onValueChange={(v) => {
                        // 소스 캘린더 또는 이미 구독된 캘린더는 선택 불가
                        if (
                            v !== sourceCalendarId &&
                            !installedCalendarIdSet.has(v)
                        ) {
                            setSelectedCalendarId(v)
                        }
                    }}
                    disabled={isBusy || isSelectedDisabled}
                >
                    <SelectTrigger className="h-auto! w-full">
                        <SelectValue
                            placeholder={
                                isSelectedDisabled
                                    ? "구독 가능한 캘린더가 없습니다."
                                    : "캘린더를 선택하세요"
                            }
                        />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {managedCalendars.map((calendar) => {
                                const isSource =
                                    calendar.id === sourceCalendarId
                                const isInstalled = installedCalendarIdSet.has(
                                    calendar.id
                                )
                                return (
                                    <SelectItem
                                        key={calendar.id}
                                        value={calendar.id}
                                        className="py-2"
                                        disabled={isSource || isInstalled}
                                    >
                                        <CalendarAvatarRow
                                            calendar={calendar}
                                            showRole
                                            isInstalled={isInstalled}
                                            isSource={isSource}
                                        />
                                    </SelectItem>
                                )
                            })}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </Field>

            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline" className="flex-1">
                        닫기
                    </Button>
                </DialogClose>
                <Button
                    onClick={handleSubscribe}
                    disabled={isBusy || isSelectedDisabled}
                    className="flex-1"
                >
                    {isSaving && <Spinner className="size-4" />}
                    구독하기
                </Button>
            </DialogFooter>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Public component
// ─────────────────────────────────────────────────────────────────────────────

export function CollectionSubscribeDialog({
    open,
    onOpenChange,
    catalogId,
    catalogName,
    sourceCalendarId,
    onSubscribed,
}: CollectionSubscribeDialogProps) {
    const myCalendars = useCalendarStore((s) => s.myCalendars)

    // owner/manager 전체 목록 — 소스 캘린더는 제외 않고 포함해 "공유중"으로 표시
    const managedCalendars = React.useMemo(
        () =>
            myCalendars.filter(
                (c) => c.role === "owner" || c.role === "manager"
            ),
        [myCalendars]
    )

    return (
        <ResponsiveModal open={open} onOpenChange={onOpenChange}>
            <ResponsiveModalContent
                title="내 캘린더에 추가"
                description={`'${catalogName}' 컬렉션을 추가할 캘린더를 선택하세요.`}
                maxWidth="sm:max-w-sm"
            >
                <CollectionSubscribeForm
                    catalogId={catalogId}
                    catalogName={catalogName}
                    managedCalendars={managedCalendars}
                    sourceCalendarId={sourceCalendarId}
                    onSubscribed={onSubscribed}
                    onClose={() => onOpenChange(false)}
                />
            </ResponsiveModalContent>
        </ResponsiveModal>
    )
}
