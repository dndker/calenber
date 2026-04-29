"use client"

import * as React from "react"

import { useSidebarCollapse } from "@/hooks/use-sidebar-collapse-state"
import { getCalendarCollectionCheckboxClassName } from "@/lib/calendar/collection-color"
import { getCollectionPublishStatus } from "@/lib/calendar/mutations"
import {
    canManageCalendar,
    canViewCalendarSettings,
} from "@/lib/calendar/permissions"
import { useCalendarStore } from "@/store/useCalendarStore"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"

import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarSeparator,
} from "@workspace/ui/components/sidebar"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import {
    ChevronRightIcon,
    EllipsisIcon,
    Globe2Icon,
    LinkIcon,
    PlusCircleIcon,
    Settings2Icon,
} from "lucide-react"
import { CollectionShareDialog } from "./calendar/collection-share-dialog"
import { CollectionSubscribeDialog } from "./calendar/collection-subscribe-dialog"
import { useSettingsModal } from "./settings/settings-modal-provider"

type FilterItem = {
    id: string
    label: string
    color?: string
    checked: boolean
    disabled?: boolean
    description?: string
}

type FilterGroup = {
    id: string
    name: string
    items: FilterItem[]
}

export const CalendarFilter = React.memo(function CalendarFilter({
    groups,
    onItemCheckedChange,
}: {
    groups: FilterGroup[]
    onItemCheckedChange?: (
        groupId: string,
        itemId: string,
        checked: boolean
    ) => void
}) {
    return (
        <>
            {groups.map((group) => (
                <CalendarFilterGroup
                    key={group.id}
                    group={group}
                    onItemCheckedChange={onItemCheckedChange}
                />
            ))}
        </>
    )
})

// ─────────────────────────────────────────────────────────────────────────────
// Publish status cache — calendarId → Map<collectionId, PublishStatus>
// ─────────────────────────────────────────────────────────────────────────────

type PublishStatus = {
    isPublished: boolean
    visibility: "public" | "unlisted" | null
    subscriberCount: number
    catalogId: string | null
    description: string
}

const publishStatusCache = new Map<string, Map<string, PublishStatus>>()

function invalidatePublishStatusCache(calendarId: string) {
    publishStatusCache.delete(calendarId)
}

function CalendarFilterGroup({
    group,
    onItemCheckedChange,
}: {
    group: FilterGroup
    onItemCheckedChange?: (
        groupId: string,
        itemId: string,
        checked: boolean
    ) => void
}) {
    const tCalendar = useDebugTranslations("calendar")
    const { openSettings } = useSettingsModal()
    const activeCalendarMembership = useCalendarStore(
        (s) => s.activeCalendarMembership
    )
    const activeCalendarId = useCalendarStore((s) => s.activeCalendar?.id)
    const canManageSettings = canManageCalendar(activeCalendarMembership)
    // 멤버 이상이면 메뉴 버튼 표시 (viewer 포함 active member)
    const isMember = canViewCalendarSettings(activeCalendarMembership)
    const [isOpen, setIsOpen] = useSidebarCollapse(`filter-${group.id}`)
    const [publishStatusMap, setPublishStatusMap] = React.useState<
        Map<string, PublishStatus>
    >(new Map())

    // 공유 설정 모달 상태
    const [shareDialogItem, setShareDialogItem] =
        React.useState<FilterItem | null>(null)

    // 구독하기 모달 상태
    const [subscribeDialogItem, setSubscribeDialogItem] =
        React.useState<FilterItem | null>(null)

    // manager/owner인 경우 공유 상태 로드
    React.useEffect(() => {
        if (
            !canManageSettings ||
            !activeCalendarId ||
            group.items.length === 0
        ) {
            return
        }

        const cached = publishStatusCache.get(activeCalendarId)
        if (cached) {
            setPublishStatusMap(cached)
            return
        }

        const supabase = createBrowserSupabase()
        getCollectionPublishStatus(supabase, activeCalendarId).then(
            (statusList) => {
                const nextMap = new Map(
                    statusList.map((s) => [
                        s.collectionId,
                        {
                            isPublished: s.isPublished,
                            visibility:
                                s.visibility === "public" ||
                                s.visibility === "unlisted"
                                    ? s.visibility
                                    : null,
                            subscriberCount: s.subscriberCount,
                            catalogId: s.catalogId,
                            description: s.description,
                        } satisfies PublishStatus,
                    ])
                )
                publishStatusCache.set(activeCalendarId, nextMap)
                setPublishStatusMap(nextMap)
            }
        )
    }, [canManageSettings, activeCalendarId, group.items.length])

    const handleShareDialogPublished = React.useCallback(
        (
            item: FilterItem,
            info: { catalogId: string; visibility: "public" | "unlisted" }
        ) => {
            if (!activeCalendarId) return
            const next = new Map(publishStatusMap)
            const prev = next.get(item.id)
            next.set(item.id, {
                isPublished: true,
                visibility: info.visibility,
                subscriberCount: prev?.subscriberCount ?? 0,
                catalogId: info.catalogId,
                description: prev?.description ?? "",
            })
            publishStatusCache.set(activeCalendarId, next)
            setPublishStatusMap(next)
        },
        [activeCalendarId, publishStatusMap]
    )

    const handleShareDialogUnpublished = React.useCallback(
        (item: FilterItem) => {
            if (!activeCalendarId) return
            const next = new Map(publishStatusMap)
            next.set(item.id, {
                isPublished: false,
                visibility: null,
                subscriberCount: 0,
                catalogId: null,
                description: "",
            })
            publishStatusCache.set(activeCalendarId, next)
            setPublishStatusMap(next)
        },
        [activeCalendarId, publishStatusMap]
    )

    const openShareDialog = React.useCallback((item: FilterItem) => {
        setShareDialogItem(item)
    }, [])

    const closeShareDialog = React.useCallback(() => {
        setShareDialogItem(null)
    }, [])

    const openSubscribeDialog = React.useCallback((item: FilterItem) => {
        setSubscribeDialogItem(item)
    }, [])

    const closeSubscribeDialog = React.useCallback(() => {
        setSubscribeDialogItem(null)
    }, [])

    const shareDialogStatus = shareDialogItem
        ? publishStatusMap.get(shareDialogItem.id)
        : undefined

    // 구독하기 모달에 넘길 catalogId — 공유된 컬렉션의 카탈로그 UUID
    const subscribeDialogStatus = subscribeDialogItem
        ? publishStatusMap.get(subscribeDialogItem.id)
        : undefined

    return (
        <React.Fragment>
            <SidebarGroup>
                <Collapsible
                    open={isOpen}
                    onOpenChange={setIsOpen}
                    className="group/collapsible"
                >
                    <SidebarGroupLabel
                        asChild
                        className="group/label w-full text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    >
                        <CollapsibleTrigger>
                            {group.name}
                            <ChevronRightIcon className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                        </CollapsibleTrigger>
                    </SidebarGroupLabel>
                    <CollapsibleContent>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {group.items.map((item, index) => {
                                    const status = publishStatusMap.get(item.id)
                                    const isPublished =
                                        status?.isPublished ?? false

                                    return (
                                        <SidebarMenuItem key={item.id}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <SidebarMenuButton
                                                        asChild
                                                        className="group/filter-item py-0!"
                                                    >
                                                        <Field
                                                            orientation="horizontal"
                                                            data-disabled={
                                                                item.disabled
                                                            }
                                                        >
                                                            <Checkbox
                                                                id={`calendar-checkbox-${group.id}-${item.id}-${index}`}
                                                                name={`calendar-checkbox-${group.id}-${item.id}-${index}`}
                                                                checked={
                                                                    item.checked
                                                                }
                                                                disabled={
                                                                    item.disabled
                                                                }
                                                                className={getCalendarCollectionCheckboxClassName(
                                                                    item.color
                                                                )}
                                                                onCheckedChange={(
                                                                    checked
                                                                ) => {
                                                                    if (
                                                                        item.disabled
                                                                    ) {
                                                                        return
                                                                    }

                                                                    onItemCheckedChange?.(
                                                                        group.id,
                                                                        item.id,
                                                                        Boolean(
                                                                            checked
                                                                        )
                                                                    )
                                                                }}
                                                            />
                                                            <FieldLabel
                                                                htmlFor={`calendar-checkbox-${group.id}-${item.id}-${index}`}
                                                                className="h-full min-w-0 flex-1 cursor-pointer truncate"
                                                            >
                                                                {item.label}
                                                            </FieldLabel>
                                                            {isMember &&
                                                                item.id !==
                                                                    "__without_collection__" && (
                                                                    <CollectionMenuButton
                                                                        item={
                                                                            item
                                                                        }
                                                                        isPublished={
                                                                            isPublished
                                                                        }
                                                                        visibility={
                                                                            status?.visibility ??
                                                                            null
                                                                        }
                                                                        canManage={
                                                                            canManageSettings
                                                                        }
                                                                        onOpenShareDialog={
                                                                            openShareDialog
                                                                        }
                                                                        onOpenSubscribeDialog={
                                                                            openSubscribeDialog
                                                                        }
                                                                    />
                                                                )}
                                                        </Field>
                                                    </SidebarMenuButton>
                                                </TooltipTrigger>
                                                {item.disabled && (
                                                    <TooltipContent side="bottom">
                                                        <p>
                                                            {item.description ??
                                                                tCalendar("filterSidebarDisabled")}
                                                        </p>
                                                    </TooltipContent>
                                                )}
                                            </Tooltip>
                                        </SidebarMenuItem>
                                    )
                                })}

                                {group.items.length === 0 && (
                                    <div className="mt-1 flex flex-col gap-1.5 px-2 pb-1">
                                        <div className="text-muted-foreground">
                                            {tCalendar("filterSidebarEmptyCollection")}
                                        </div>
                                        {canManageSettings && (
                                            <Button
                                                variant="outline"
                                                onClick={() =>
                                                    openSettings(
                                                        "calendar_data"
                                                    )
                                                }
                                            >
                                                {tCalendar("filterSidebarCollectionSettings")}
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </CollapsibleContent>
                </Collapsible>
            </SidebarGroup>
            <SidebarSeparator className="mx-0" />

            {/* 공유 설정 모달 */}
            {shareDialogItem && (
                <CollectionShareDialog
                    open={Boolean(shareDialogItem)}
                    onOpenChange={(open) => {
                        if (!open) closeShareDialog()
                    }}
                    collection={{
                        id: shareDialogItem.id,
                        name: shareDialogItem.label,
                        description: shareDialogStatus?.description,
                    }}
                    isPublished={shareDialogStatus?.isPublished ?? false}
                    currentVisibility={shareDialogStatus?.visibility}
                    subscriberCount={shareDialogStatus?.subscriberCount}
                    onPublished={(info) =>
                        handleShareDialogPublished(shareDialogItem, info)
                    }
                    onUnpublished={() =>
                        handleShareDialogUnpublished(shareDialogItem)
                    }
                    onCollectionRenamed={() => {
                        if (activeCalendarId) {
                            invalidatePublishStatusCache(activeCalendarId)
                        }
                    }}
                />
            )}

            {/* 구독하기 모달 */}
            {subscribeDialogItem && subscribeDialogStatus?.catalogId && (
                <CollectionSubscribeDialog
                    open={Boolean(subscribeDialogItem)}
                    onOpenChange={(open) => {
                        if (!open) closeSubscribeDialog()
                    }}
                    catalogId={subscribeDialogStatus.catalogId}
                    catalogName={subscribeDialogItem.label}
                    sourceCalendarId={activeCalendarId}
                    onSubscribed={closeSubscribeDialog}
                />
            )}
        </React.Fragment>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// CollectionMenuButton — 권한에 따라 메뉴 항목 분기
//   - 멤버(viewer/editor): 구독하기 (컬렉션이 공유된 경우에만)
//   - 관리자(manager/owner): 구독하기 + 공유 설정/공유하기
// ─────────────────────────────────────────────────────────────────────────────

function CollectionMenuButton({
    item,
    isPublished,
    visibility,
    canManage,
    onOpenShareDialog,
    onOpenSubscribeDialog,
}: {
    item: FilterItem
    isPublished: boolean
    visibility: "public" | "unlisted" | null
    canManage: boolean
    onOpenShareDialog: (item: FilterItem) => void
    onOpenSubscribeDialog: (item: FilterItem) => void
}) {
    const t = useDebugTranslations("calendar.filterMenu")
    // 멤버 전용: 공유된 컬렉션이 없으면 메뉴 자체를 숨김
    if (!canManage && !isPublished) {
        return null
    }

    // 공유 상태 아이콘: public → Globe2Icon, unlisted → LinkIcon
    // 평소엔 공유 상태 아이콘을 표시하고, 호버 시 EllipsisIcon으로 교체
    const ShareStatusIcon =
        visibility === "public"
            ? Globe2Icon
            : visibility === "unlisted"
              ? LinkIcon
              : null

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <SidebarMenuAction
                    onClick={(e) => e.stopPropagation()}
                    showOnHover={!ShareStatusIcon}
                    className="right-1.25"
                >
                    {ShareStatusIcon ? (
                        <>
                            <ShareStatusIcon className="size-3.5 text-muted-foreground/80! group-hover/filter-item:hidden" />
                            <EllipsisIcon className="hidden size-3.5 group-hover/filter-item:block" />
                        </>
                    ) : (
                        <EllipsisIcon className="size-3.5" />
                    )}
                </SidebarMenuAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="bottom" className="w-40">
                {/* 구독하기 — 공유된 컬렉션이 있을 때 모든 멤버에게 표시 */}
                {isPublished && (
                    <DropdownMenuItem
                        onClick={(e) => {
                            e.stopPropagation()
                            onOpenSubscribeDialog(item)
                        }}
                    >
                        <PlusCircleIcon className="size-4 text-muted-foreground" />
                        <span>{t("addToMyCalendar")}</span>
                    </DropdownMenuItem>
                )}

                {/* 공유 설정 — 관리자/소유자만 */}
                {canManage && (
                    <>
                        {isPublished && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                            onClick={(e) => {
                                e.stopPropagation()
                                onOpenShareDialog(item)
                            }}
                        >
                            {isPublished ? (
                                <>
                                    <Settings2Icon className="size-4 text-muted-foreground" />
                                    <span>{t("shareSettings")}</span>
                                </>
                            ) : (
                                <>
                                    <Globe2Icon className="size-4 text-muted-foreground" />
                                    <span>{t("share")}</span>
                                </>
                            )}
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

CalendarFilter.displayName = "CalendarFilter"
