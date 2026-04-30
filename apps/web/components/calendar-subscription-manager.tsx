"use client"

import { GoogleCalendarSubscribeForm } from "@/components/calendar/google-calendar-subscribe-dialog"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { useCalendarSubscriptions } from "@/hooks/use-calendar-subscriptions"
import { useSidebarCollapse } from "@/hooks/use-sidebar-collapse-state"
import { getCalendarCollectionCheckboxClassName } from "@/lib/calendar/collection-color"
import { fetchAndNormalizeSubscriptionCatalogs } from "@/lib/calendar/queries"
import { canManageCalendar } from "@/lib/calendar/permissions"
import { useCalendarStore } from "@/store/useCalendarStore"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@workspace/ui/components/command"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@workspace/ui/components/dialog"
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
import { useMemo, useState } from "react"
import { GoogleCalendarIcon } from "./icon/google-calendar-icon"
import { VerifiedIcon } from "./icon/verified-icon"

type SubscribeDialogView = "subscriptions" | "google"

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
    const setSubscriptionCatalogs = useCalendarStore((s) => s.setSubscriptionCatalogs)
    const setSubscriptionState = useCalendarStore((s) => s.setSubscriptionState)
    const canManage = canManageCalendar(activeCalendarMembership)
    const [isOpen, setIsOpen] = useSidebarCollapse("subscription")
    const [query, setQuery] = useState("")
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [dialogView, setDialogView] =
        useState<SubscribeDialogView>("subscriptions")
    const keyword = normalizeKeyword(query)

    const searchableSubscriptions = useMemo(() => {
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

    const sortedSubscriptions = useMemo(() => {
        const system: typeof searchableSubscriptions = []
        const shared: typeof searchableSubscriptions = []
        const others: typeof searchableSubscriptions = []

        for (const subscription of searchableSubscriptions) {
            if (subscription.authority === "system") {
                system.push(subscription)
                continue
            }

            if (subscription.sourceType === "shared_collection") {
                shared.push(subscription)
                continue
            }

            others.push(subscription)
        }

        return [...system, ...shared, ...others]
    }, [searchableSubscriptions])

    const shouldShowGoogleAction =
        !keyword ||
        "google".includes(keyword) ||
        t("addGoogleCalendar").toLowerCase().includes(keyword)

    const subscriptionItems = useMemo(() => {
        const items: Array<
            | {
                  type: "subscription"
                  subscription: (typeof sortedSubscriptions)[number]
              }
            | { type: "googleAction" }
        > = []

        if (keyword) {
            for (const subscription of sortedSubscriptions) {
                items.push({ type: "subscription", subscription })
            }

            if (shouldShowGoogleAction) {
                items.push({ type: "googleAction" })
            }

            return items
        }

        const system = sortedSubscriptions.filter(
            (s) => s.authority === "system"
        )
        const shared = sortedSubscriptions.filter(
            (s) =>
                s.sourceType === "shared_collection" && s.authority !== "system"
        )
        const others = sortedSubscriptions.filter(
            (s) =>
                s.authority !== "system" && s.sourceType !== "shared_collection"
        )

        for (const subscription of system) {
            items.push({ type: "subscription", subscription })
        }

        if (shouldShowGoogleAction) {
            items.push({ type: "googleAction" })
        }

        for (const subscription of shared) {
            items.push({ type: "subscription", subscription })
        }

        for (const subscription of others) {
            items.push({ type: "subscription", subscription })
        }

        return items
    }, [keyword, shouldShowGoogleAction, sortedSubscriptions])

    function openDialog() {
        setDialogView("subscriptions")
        setIsDialogOpen(true)
        setQuery("")
    }

    async function handleGoogleSubscribed() {
        if (!activeCalendarId || activeCalendarId === "demo") return
        const supabase = createBrowserSupabase()
        const { catalogs, installedIds, hiddenIds } =
            await fetchAndNormalizeSubscriptionCatalogs(supabase, activeCalendarId)
        setSubscriptionCatalogs(catalogs)
        setSubscriptionState({
            installedSubscriptionIds: installedIds,
            hiddenSubscriptionIds: hiddenIds,
        })
        setIsDialogOpen(false)
    }

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
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <div
                                                className="pointer-event-all flex size-4 items-center justify-center rounded-lg hover:bg-muted"
                                                onClick={(event) => {
                                                    event.preventDefault()
                                                    event.stopPropagation()
                                                    openDialog()
                                                }}
                                            >
                                                <PlusIcon className="size-4" />
                                            </div>
                                        </DropdownMenuTrigger>
                                    </DropdownMenu>
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

            {/* 통합 구독 추가 다이얼로그 */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent
                    className="gap-0 overflow-hidden p-0 sm:max-w-lg"
                    aria-describedby={undefined}
                >
                    <DialogHeader className="px-4 pt-4 pb-0">
                        <DialogTitle>{t("dialogTitle")}</DialogTitle>
                    </DialogHeader>

                    {dialogView === "subscriptions" && (
                        <Command shouldFilter={false}>
                            <CommandInput
                                value={query}
                                onValueChange={setQuery}
                                placeholder={t("searchPlaceholder")}
                            />
                            <CommandList className="max-h-80">
                                {searchableSubscriptions.length === 0 ? (
                                    <CommandEmpty className="-mb-2 py-6 text-center text-sm text-muted-foreground">
                                        {t("emptySearch")}
                                    </CommandEmpty>
                                ) : null}
                                {subscriptionItems.length > 0 && (
                                    <CommandGroup
                                        heading={t("searchResults", {
                                            count: subscriptionItems.length,
                                        })}
                                    >
                                        {subscriptionItems.map((item) => {
                                            if (item.type === "googleAction") {
                                                return (
                                                    <CommandItem
                                                        className="p-2.5 [&>svg]:hidden"
                                                        key="google-action"
                                                        value={t(
                                                            "addGoogleCalendar"
                                                        )}
                                                        onSelect={() => {
                                                            setDialogView(
                                                                "google"
                                                            )
                                                            setQuery("")
                                                        }}
                                                    >
                                                        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
                                                            <GoogleCalendarIcon />
                                                            <span className="flex items-center gap-1">
                                                                {t(
                                                                    "addGoogleCalendar"
                                                                )}
                                                                <VerifiedIcon />
                                                            </span>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={(
                                                                event
                                                            ) => {
                                                                event.preventDefault()
                                                                event.stopPropagation()
                                                                setDialogView(
                                                                    "google"
                                                                )
                                                                setQuery("")
                                                            }}
                                                        >
                                                            {t("subscribe")}
                                                        </Button>
                                                    </CommandItem>
                                                )
                                            }

                                            const subscription =
                                                item.subscription
                                            const isInstalled =
                                                installedIdSet.has(
                                                    subscription.id
                                                )
                                            const isUnlisted =
                                                subscription.sourceType ===
                                                    "shared_collection" &&
                                                subscription.visibility ===
                                                    "unlisted"
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
                                                isInstalled ||
                                                isUnlisted ||
                                                isMyPublished

                                            return (
                                                <CommandItem
                                                    className="p-2.5 [&>svg]:hidden"
                                                    key={subscription.id}
                                                    value={`${subscription.name} ${subscription.description} ${subscription.tags.join(" ")}`}
                                                    onSelect={() => {
                                                        if (isBlocked) return
                                                        installSubscription(
                                                            subscription.id
                                                        )
                                                        setIsDialogOpen(false)
                                                        setQuery("")
                                                    }}
                                                >
                                                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                                        <div className="flex items-center gap-1 text-sm font-medium">
                                                            <span className="truncate">
                                                                {
                                                                    subscription.name
                                                                }
                                                            </span>
                                                            {subscription.verified && (
                                                                <VerifiedIcon />
                                                            )}
                                                            {isUnlisted && (
                                                                <span className="ml-0.5 inline-flex items-center gap-0.5 rounded-sm border border-border bg-muted px-1 py-px text-[10px] font-normal text-muted-foreground">
                                                                    <LockIcon className="size-2.5" />
                                                                    {t(
                                                                        "linkOnly"
                                                                    )}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="line-clamp-2 text-xs break-keep text-muted-foreground">
                                                            {
                                                                subscription.description
                                                            }
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
                                                            if (isBlocked)
                                                                return
                                                            installSubscription(
                                                                subscription.id
                                                            )
                                                            setIsDialogOpen(
                                                                false
                                                            )
                                                            setQuery("")
                                                        }}
                                                    >
                                                        {isMyPublished
                                                            ? t("shared")
                                                            : isInstalled
                                                              ? t("subscribed")
                                                              : isUnlisted
                                                                ? t(
                                                                      "linkRequired"
                                                                  )
                                                                : t(
                                                                      "subscribe"
                                                                  )}
                                                    </Button>
                                                </CommandItem>
                                            )
                                        })}
                                    </CommandGroup>
                                )}
                            </CommandList>
                        </Command>
                    )}

                    {dialogView === "google" && (
                        <div className="p-4">
                            <GoogleCalendarSubscribeForm
                                onSubscribed={() => { void handleGoogleSubscribed() }}
                                onClose={() => setIsDialogOpen(false)}
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
