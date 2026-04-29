"use client"

/**
 * CollectionShareDialog — 컬렉션을 구독 카탈로그로 공유하거나 기존 공유 설정을
 * 수정하는 반응형 모달.
 *
 * 진입 경로:
 *   1. CalendarFilter 사이드바 항목의 "공유하기 / 공유 설정" 드롭다운 메뉴
 *   2. EventCollectionSettingsPanel 컬렉션 편집 서브메뉴의 "공유하기" 버튼
 *
 * 동작:
 *   - 미발행 컬렉션: 이름(컬렉션 이름 기본값)·설명·공개 범위 입력 후 발행
 *   - 이미 발행된 컬렉션: 기존 값 표시 + 수정 후 저장
 *   - 이름 변경 시 컬렉션 이름도 함께 업데이트 (`updateCalendarEventCollection` 재사용)
 *   - 공유 비활성화: unpublishCollectionSubscription 후 모달 닫기
 */

import {
    ResponsiveModal,
    ResponsiveModalContent,
} from "@/components/responsive-modal"
import {
    publishCollectionAsSubscription,
    unpublishCollectionSubscription,
    updateCalendarEventCollection,
} from "@/lib/calendar/mutations"
import { useCalendarStore } from "@/store/useCalendarStore"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { DialogClose, DialogFooter } from "@workspace/ui/components/dialog"
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSet,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"

import { Globe2Icon, GlobeLockIcon, GlobeOffIcon } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** 공유 모달에 넘기는 컬렉션 메타 */
export type ShareDialogCollection = {
    id: string
    name: string
    description?: string | null
}

export type CollectionShareDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void

    /** 대상 컬렉션 */
    collection: ShareDialogCollection

    /** 이미 발행된 경우의 구독 카탈로그 메타 */
    publishedCatalogId?: string | null
    isPublished: boolean
    currentVisibility?: "public" | "unlisted" | null
    /** 현재 구독자 수 */
    subscriberCount?: number

    /** 저장 성공 후 부모 상태 동기화 콜백 */
    onPublished?: (info: {
        catalogId: string
        visibility: "public" | "unlisted"
    }) => void
    onUnpublished?: () => void
    /** 이름 변경이 저장된 경우 — collection rename 을 부모에게 전파 */
    onCollectionRenamed?: (nextName: string) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Visibility option metadata
// ─────────────────────────────────────────────────────────────────────────────

type VisibilityValue = "public" | "unlisted" | "private"

type VisibilityOption = {
    value: VisibilityValue
    icon: React.ElementType
    label: string
    description: string
}

const VISIBILITY_OPTIONS: VisibilityOption[] = [
    {
        value: "private",
        icon: GlobeOffIcon,
        label: "공유 안함",
        description: "구독 리스트에서 노출되지 않으며, 공유가 비활성화됩니다.",
    },
    {
        value: "public",
        icon: Globe2Icon,
        label: "누구나 구독 가능",
        description:
            "구독 리스트에 공개되어 누구나 검색하고 구독할 수 있습니다.",
    },
    {
        value: "unlisted",
        icon: GlobeLockIcon,
        label: "링크로만 구독 가능",
        description:
            "검색에는 노출되지 않고, 링크를 아는 사람만 구독할 수 있습니다.",
    },
]

// ─────────────────────────────────────────────────────────────────────────────
// Form inner component — keeps the logic out of the modal shell
// ─────────────────────────────────────────────────────────────────────────────

function CollectionShareForm({
    collection,
    isPublished,
    currentVisibility,
    subscriberCount = 0,
    activeCalendarId,
    onPublished,
    onUnpublished,
    onCollectionRenamed,
    onClose,
}: Pick<
    CollectionShareDialogProps,
    | "collection"
    | "isPublished"
    | "currentVisibility"
    | "subscriberCount"
    | "onPublished"
    | "onUnpublished"
    | "onCollectionRenamed"
> & {
    activeCalendarId: string
    onClose: () => void
}) {
    const upsertEventCollectionSnapshot = useCalendarStore(
        (s) => s.upsertEventCollectionSnapshot
    )

    const [name, setName] = React.useState(collection.name)
    const [description, setDescription] = React.useState(
        collection.description ?? ""
    )
    const [visibility, setVisibility] = React.useState<VisibilityValue>(
        isPublished ? (currentVisibility ?? "public") : "private"
    )
    const [isSaving, setIsSaving] = React.useState(false)

    // isPublished / currentVisibility 가 바뀌면 visibility 초기값 리셋
    React.useEffect(() => {
        setVisibility(isPublished ? (currentVisibility ?? "public") : "private")
    }, [isPublished, currentVisibility])

    // 이름 필드 초기값 — 컬렉션 이름이 바뀌면 반영
    React.useEffect(() => {
        setName(collection.name)
    }, [collection.name])

    const handleSave = async () => {
        setIsSaving(true)
        const supabase = createBrowserSupabase()

        try {
            if (visibility === "private") {
                // "공개 안함" 선택 → 발행된 경우에만 unpublish 호출
                if (isPublished) {
                    const ok = await unpublishCollectionSubscription(supabase, {
                        calendarId: activeCalendarId,
                        collectionId: collection.id,
                    })
                    if (!ok) {
                        toast.error("공유를 비활성화하지 못했습니다.")
                        return
                    }
                    onUnpublished?.()
                    toast.success("컬렉션 공유가 비활성화되었습니다.")
                }
                onClose()
                return
            }

            const trimmedName = name.trim()
            if (!trimmedName) {
                toast.error("컬렉션 이름을 입력해 주세요.")
                return
            }

            // 카탈로그 발행 or 업데이트 (publish RPC는 upsert로 동작)
            const result = await publishCollectionAsSubscription(supabase, {
                calendarId: activeCalendarId,
                collectionId: collection.id,
                name: trimmedName,
                description: description.trim(),
                visibility,
            })

            if (!result) {
                toast.error("공유 설정을 저장하지 못했습니다.")
                return
            }

            // 이름이 바뀌었으면 컬렉션 레코드도 업데이트
            if (trimmedName !== collection.name) {
                const updatedCollection = await updateCalendarEventCollection(
                    supabase,
                    collection.id,
                    { name: trimmedName }
                )
                if (updatedCollection) {
                    upsertEventCollectionSnapshot(updatedCollection)
                    onCollectionRenamed?.(trimmedName)
                }
            }

            onPublished?.({ catalogId: result.catalogId, visibility })
            toast.success(
                isPublished
                    ? "공유 설정이 저장되었습니다."
                    : "컬렉션 공유가 시작되었습니다."
            )
            onClose()
        } catch {
            toast.error("오류가 발생했습니다. 다시 시도해 주세요.")
        } finally {
            setIsSaving(false)
        }
    }

    const isBusy = isSaving

    return (
        <div className="flex flex-col gap-5">
            {/* 주의 문구 */}
            {/* 현재 상태 배지 */}
            {/* {isPublished && (
                <Alert className="bg-muted">
                    <Globe2Icon />

                    <AlertTitle>
                        컬렉션 공개됨{" "}
                       
                    </AlertTitle>
                    <AlertDescription className="text-xs">
                        공유된 컬렉션의 일정은 구독자가 열람만 할 수 있으며,
                        <br /> 편집 권한은 부여되지 않습니다.
                    </AlertDescription>
                </Alert>
            )} */}

            {/* 공개 범위 */}
            <FieldSet>
                <FieldLegend variant="label">공개 범위</FieldLegend>
                <Field>
                    <Select
                        value={visibility}
                        onValueChange={(v) => {
                            setVisibility(v as VisibilityValue)
                        }}
                        disabled={isBusy}
                    >
                        <SelectTrigger className="h-auto!">
                            <SelectValue className="h-auto! flex-1 items-start" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {VISIBILITY_OPTIONS.map((opt) => {
                                    const current =
                                        currentVisibility === opt.value ||
                                        (!currentVisibility &&
                                            opt.value === "private")

                                    const Icon = opt.icon

                                    return (
                                        <SelectItem
                                            value={opt.value}
                                            key={opt.value}
                                            className="py-1.5"
                                        >
                                            <div className="flex gap-1.75">
                                                <Icon className="mt-0.5 size-4 shrink-0" />
                                                <div>
                                                    <p className="font-base flex items-center gap-1 font-medium">
                                                        {/* <Icon className="size-4 shrink-0" /> */}
                                                        {opt.label}
                                                        {current &&
                                                            isPublished &&
                                                            subscriberCount >
                                                                0 && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="px-1.5 text-xs text-muted-foreground"
                                                                >
                                                                    {subscriberCount.toLocaleString()}
                                                                    명 구독 중
                                                                </Badge>
                                                            )}
                                                    </p>
                                                    <span className="truncate text-xs text-muted-foreground">
                                                        {opt.description}
                                                    </span>
                                                </div>
                                            </div>
                                        </SelectItem>
                                    )
                                })}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </Field>
            </FieldSet>

            <FieldGroup>
                {/* 이름 / 설명 — "공개 안함" 선택 시 불필요하므로 숨김 */}
                {visibility !== "private" && (
                    <>
                        <Field>
                            <FieldLabel htmlFor="collection-share-name">
                                컬렉션 이름
                            </FieldLabel>
                            <Input
                                id="collection-share-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="컬렉션 이름"
                                disabled={isBusy}
                                maxLength={80}
                            />
                            <FieldDescription>
                                컬렉션 이름이 함께 변경됩니다.
                            </FieldDescription>
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="collection-share-description">
                                설명{" "}
                                <span className="font-normal text-muted-foreground">
                                    (선택)
                                </span>
                            </FieldLabel>
                            <Textarea
                                id="collection-share-description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="컬렉션 설명을 입력해주세요."
                                disabled={isBusy}
                                className="resize-none"
                                rows={3}
                                maxLength={500}
                            />
                        </Field>
                    </>
                )}
            </FieldGroup>

            {/* 액션 버튼 */}
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline" className="flex-1">
                        닫기
                    </Button>
                </DialogClose>
                <Button
                    onClick={handleSave}
                    disabled={
                        isBusy || (visibility !== "private" && !name.trim())
                    }
                    className="flex-1"
                >
                    {isSaving ? (
                        <Spinner className="size-4" />
                    ) : visibility === "private" ? (
                        isPublished ? (
                            "공유 비활성화"
                        ) : (
                            "확인"
                        )
                    ) : isPublished ? (
                        "설정 저장"
                    ) : (
                        "공유 시작"
                    )}
                </Button>
            </DialogFooter>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Public component
// ─────────────────────────────────────────────────────────────────────────────

export function CollectionShareDialog({
    open,
    onOpenChange,
    collection,
    isPublished,
    currentVisibility,
    subscriberCount,
    onPublished,
    onUnpublished,
    onCollectionRenamed,
}: CollectionShareDialogProps) {
    const activeCalendarId = useCalendarStore((s) => s.activeCalendar?.id)

    if (!activeCalendarId) {
        return null
    }

    const title = isPublished ? "컬렉션 공유 설정" : "컬렉션 공유하기"
    const description = isPublished
        ? "공유 설정을 수정하거나 공유를 비활성화할 수 있습니다."
        : "컬렉션을 공개하면 다른 사람들이 구독할 수 있습니다."

    return (
        <ResponsiveModal open={open} onOpenChange={onOpenChange}>
            <ResponsiveModalContent
                title={title}
                description={description}
                maxWidth="sm:max-w-md"
            >
                <CollectionShareForm
                    collection={collection}
                    isPublished={isPublished}
                    currentVisibility={currentVisibility}
                    subscriberCount={subscriberCount}
                    activeCalendarId={activeCalendarId}
                    onPublished={onPublished}
                    onUnpublished={onUnpublished}
                    onCollectionRenamed={onCollectionRenamed}
                    onClose={() => onOpenChange(false)}
                />
            </ResponsiveModalContent>
        </ResponsiveModal>
    )
}
