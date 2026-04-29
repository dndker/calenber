"use client"

import { useCalendarSubscriptions } from "@/hooks/use-calendar-subscriptions"
import { useSidebarCollapse } from "@/hooks/use-sidebar-collapse-state"
import { getCalendarCollectionCheckboxClassName } from "@/lib/calendar/collection-color"
import { canManageCalendar } from "@/lib/calendar/permissions"
import { useCalendarStore } from "@/store/useCalendarStore"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@workspace/ui/components/command"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
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
import { cn } from "@workspace/ui/lib/utils"
import {
    ChevronRightIcon,
    LockIcon,
    MoreHorizontalIcon,
    PlusIcon,
    Trash2Icon,
    UsersIcon,
} from "lucide-react"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { useMemo, useState } from "react"
import { VerifiedIcon } from "./icon/verified-icon"

function normalizeKeyword(value: string) {
    return value.trim().toLowerCase()
}

export function CalendarSubscriptionManager() {
    const t = useDebugTranslations("calendar.subscriptionManager")
    const {
        subscriptions,
        installedSubscriptions,
        installedIdSet,
        hiddenIdSet,
        installSubscription,
        uninstallSubscription,
        toggleSubscriptionVisibility,
    } = useCalendarSubscriptions()
    const activeCalendarId = useCalendarStore((s) => s.activeCalendar?.id)
    const activeCalendarMembership = useCalendarStore(
        (s) => s.activeCalendarMembership
    )
    const canManage = canManageCalendar(activeCalendarMembership)
    const [isOpen, setIsOpen] = useSidebarCollapse("subscription")
    const [query, setQuery] = useState("")
    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const keyword = normalizeKeyword(query)

    const searchableSubscriptions = useMemo(() => {
        // source_deleted/archived 항목 및 unlisted(비공개 링크) 항목은 검색 목록에서 제외
        const available = subscriptions.filter(
            (s) =>
                s.status !== "source_deleted" &&
                s.status !== "archived" &&
                !(
                    s.sourceType === "shared_collection" &&
                    s.visibility === "unlisted"
                )
        )

        if (!keyword) {
            return available
        }

        return available.filter((subscription) => {
            return (
                subscription.name.toLowerCase().includes(keyword) ||
                subscription.description.toLowerCase().includes(keyword) ||
                subscription.tags.some((tag) =>
                    tag.toLowerCase().includes(keyword)
                )
            )
        })
    }, [keyword, subscriptions])

    return (
        <>
            <SidebarGroup>
                <Collapsible
                    open={isOpen}
                    onOpenChange={setIsOpen}
                    className="group/collapsible"
                >
                    <SidebarGroupLabel
                        asChild
                        className={cn(
                            "group/label w-full text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                    >
                        <CollapsibleTrigger>
                            <div className="flex items-center gap-1">
                                {t("title")}
                            </div>
                            <div className="ml-auto flex items-center gap-1.5">
                                {canManage && (
                                    <div
                                        className="pointer-event-all flex size-4 items-center justify-center rounded-lg hover:bg-muted"
                                        onClick={(event) => {
                                            event.preventDefault()
                                            event.stopPropagation()
                                            setIsSearchOpen(true)
                                        }}
                                    >
                                        <PlusIcon className="size-4" />
                                    </div>
                                )}
                                <ChevronRightIcon className="size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                            </div>
                        </CollapsibleTrigger>
                    </SidebarGroupLabel>
                    <CollapsibleContent>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {installedSubscriptions.map(
                                    (subscription, index) => {
                                        const isInstalled = installedIdSet.has(
                                            subscription.id
                                        )
                                        const isVisible =
                                            isInstalled &&
                                            !hiddenIdSet.has(subscription.id)

                                        return (
                                            <SidebarMenuItem
                                                key={subscription.id}
                                            >
                                                <SidebarMenuButton asChild>
                                                    <Field
                                                        orientation="horizontal"
                                                        className="h-auto items-start"
                                                    >
                                                        <Checkbox
                                                            id={`calendar-subscription-${subscription.id}-${index}`}
                                                            name={`calendar-subscription-${subscription.id}-${index}`}
                                                            className={getCalendarCollectionCheckboxClassName(
                                                                subscription.collectionColor ??
                                                                    "red"
                                                            )}
                                                            checked={isVisible}
                                                            disabled={
                                                                !isInstalled
                                                            }
                                                            onCheckedChange={() =>
                                                                toggleSubscriptionVisibility(
                                                                    subscription.id
                                                                )
                                                            }
                                                        />
                                                        <FieldLabel
                                                            htmlFor={`calendar-subscription-${subscription.id}-${index}`}
                                                            className="-mt-px h-full min-w-0 flex-1 cursor-pointer flex-col items-start gap-0.75"
                                                        >
                                                            <div className="flex items-center gap-0.5 text-sm">
                                                                <span className="truncate">
                                                                    {
                                                                        subscription.name
                                                                    }
                                                                </span>
                                                                {subscription.verified && (
                                                                    <VerifiedIcon
                                                                        className="text-primary"
                                                                        size="sm"
                                                                    />
                                                                )}
                                                            </div>
                                                        </FieldLabel>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger
                                                                asChild
                                                            >
                                                                <SidebarMenuAction
                                                                    showOnHover
                                                                    className="right-1.5"
                                                                >
                                                                    <MoreHorizontalIcon />
                                                                    <span className="sr-only">
                                                                        More
                                                                    </span>
                                                                </SidebarMenuAction>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent
                                                                align="start"
                                                                side="bottom"
                                                                className="w-auto"
                                                            >
                                                                <DropdownMenuItem
                                                                    onClick={() =>
                                                                        uninstallSubscription(
                                                                            subscription.id
                                                                        )
                                                                    }
                                                                >
                                                                    <Trash2Icon />
                                                                    <span>
                                                                        {t(
                                                                            "unsubscribe"
                                                                        )}
                                                                    </span>
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </Field>
                                                </SidebarMenuButton>
                                            </SidebarMenuItem>
                                        )
                                    }
                                )}
                            </SidebarMenu>

                            {installedSubscriptions.length === 0 && (
                                <SidebarMenu>
                                    <SidebarMenuItem>
                                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                            {t("emptyInstalled")}
                                        </div>
                                    </SidebarMenuItem>
                                </SidebarMenu>
                            )}
                        </SidebarGroupContent>
                    </CollapsibleContent>
                </Collapsible>
            </SidebarGroup>
            <SidebarSeparator className="mx-0" />

            <CommandDialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                <Command shouldFilter={false}>
                    <CommandInput
                        value={query}
                        onValueChange={setQuery}
                        placeholder={t("searchPlaceholder")}
                    />
                    <CommandList>
                        {searchableSubscriptions.length === 0 ? (
                            <CommandEmpty className="-mb-2 py-6 text-center text-sm text-muted-foreground">
                                {t("emptySearch")}
                            </CommandEmpty>
                        ) : null}
                        <CommandGroup
                            heading={
                                searchableSubscriptions.length === 0
                                    ? undefined
                                    : t("searchResults", {
                                          count: searchableSubscriptions.length,
                                      })
                            }
                        >
                            {searchableSubscriptions.map((subscription) => {
                                const isInstalled = installedIdSet.has(
                                    subscription.id
                                )
                                // unlisted 구독은 직접 구독 불가 (링크 필요) — 방어 처리
                                const isUnlisted =
                                    subscription.sourceType ===
                                        "shared_collection" &&
                                    subscription.visibility === "unlisted"
                                // 현재 활성 캘린더에서 배포한 컬렉션 — "공유중" 표시
                                const isMyPublished =
                                    !isInstalled &&
                                    subscription.sourceType ===
                                        "shared_collection" &&
                                    Boolean(
                                        subscription.calendar?.id &&
                                        subscription.calendar.id ===
                                            activeCalendarId
                                    )

                                const isBlocked =
                                    isInstalled || isUnlisted || isMyPublished

                                return (
                                    <CommandItem
                                        className="p-2.5 [&>svg]:hidden"
                                        key={subscription.id}
                                        value={`${subscription.name} ${subscription.description} ${subscription.tags.join(" ")}`}
                                        onSelect={() => {
                                            if (isBlocked) {
                                                return
                                            }
                                            installSubscription(subscription.id)
                                            setIsSearchOpen(false)
                                            setQuery("")
                                        }}
                                    >
                                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                            <div className="flex items-center gap-1 text-sm font-medium">
                                                <span className="truncate">
                                                    {subscription.name}
                                                </span>
                                                {subscription.verified && (
                                                    <VerifiedIcon />
                                                )}
                                                {isUnlisted && (
                                                    <span className="ml-0.5 inline-flex items-center gap-0.5 rounded-sm border border-border bg-muted px-1 py-px text-[10px] font-normal text-muted-foreground">
                                                        <LockIcon className="size-2.5" />
                                                        {t("linkOnly")}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="line-clamp-2 text-xs break-keep text-muted-foreground">
                                                {subscription.description}
                                            </p>
                                            {subscription.sourceType ===
                                                "shared_collection" &&
                                                !isUnlisted && (
                                                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                                                        <UsersIcon className="size-3 shrink-0" />
                                                        <span>
                                                            {t(
                                                                "publicAvailable"
                                                            )}
                                                        </span>
                                                    </div>
                                                )}
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={isBlocked}
                                            onClick={(event) => {
                                                event.preventDefault()
                                                event.stopPropagation()
                                                if (isBlocked) {
                                                    return
                                                }
                                                installSubscription(
                                                    subscription.id
                                                )
                                                setIsSearchOpen(false)
                                                setQuery("")
                                            }}
                                        >
                                            {isMyPublished
                                                ? t("shared")
                                                : isInstalled
                                                  ? t("subscribed")
                                                  : isUnlisted
                                                    ? t("linkRequired")
                                                    : t("subscribe")}
                                        </Button>
                                    </CommandItem>
                                )
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </CommandDialog>
        </>
    )
}
