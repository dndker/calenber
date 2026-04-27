"use client"

import { useCalendarSubscriptions } from "@/hooks/use-calendar-subscriptions"
import { useSidebarCollapse } from "@/hooks/use-sidebar-collapse-state"
import { getCalendarCategoryCheckboxClassName } from "@/lib/calendar/category-color"
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
import { Field, FieldLabel } from "@workspace/ui/components/field"
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarSeparator,
} from "@workspace/ui/components/sidebar"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronRightIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useMemo, useState } from "react"
import { VerifiedIcon } from "./icon/verified-icon"

function normalizeKeyword(value: string) {
    return value.trim().toLowerCase()
}

export function CalendarSubscriptionManager() {
    const {
        subscriptions,
        installedSubscriptions,
        installedIdSet,
        hiddenIdSet,
        installSubscription,
        uninstallSubscription,
        toggleSubscriptionVisibility,
    } = useCalendarSubscriptions()
    const [isOpen, setIsOpen] = useSidebarCollapse("subscription")
    const [query, setQuery] = useState("")
    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const keyword = normalizeKeyword(query)

    const searchableSubscriptions = useMemo(() => {
        if (!keyword) {
            return subscriptions
        }

        return subscriptions.filter((subscription) => {
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
                                구독
                                {/* {installedSubscriptions.length > 0 ? (
                                    <Badge variant="outline">
                                        {installedSubscriptions.length}개
                                    </Badge>
                                ) : null} */}
                            </div>
                            <div className="ml-auto flex items-center gap-1.5">
                                <div
                                    className="pointer-event-all ml-auto flex size-4 items-center justify-center rounded-lg hover:bg-muted"
                                    onClick={(event) => {
                                        event.preventDefault()
                                        event.stopPropagation()
                                        setIsSearchOpen(true)
                                    }}
                                >
                                    <PlusIcon className="size-4" />
                                </div>
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
                                                            className={getCalendarCategoryCheckboxClassName(
                                                                subscription.categoryColor ??
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
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="size-4 text-muted-foreground"
                                                            onClick={() =>
                                                                uninstallSubscription(
                                                                    subscription.id
                                                                )
                                                            }
                                                        >
                                                            <Trash2Icon />
                                                        </Button>
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
                                            구독된 일정이 없습니다.
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
                        placeholder="구독 캘린더 검색"
                    />
                    <CommandList>
                        {searchableSubscriptions.length === 0 ? (
                            <CommandEmpty className="-mb-2 py-6 text-center text-sm text-muted-foreground">
                                검색 결과가 없습니다.
                            </CommandEmpty>
                        ) : null}
                        <CommandGroup
                            heading={
                                searchableSubscriptions.length === 0
                                    ? undefined
                                    : `검색 결과 (${searchableSubscriptions.length}개)`
                            }
                        >
                            {searchableSubscriptions.map((subscription) => {
                                const isInstalled = installedIdSet.has(
                                    subscription.id
                                )

                                return (
                                    <CommandItem
                                        className="p-2.5 [&>svg]:hidden"
                                        key={subscription.id}
                                        value={`${subscription.name} ${subscription.description} ${subscription.tags.join(" ")}`}
                                        onSelect={() => {
                                            if (isInstalled) {
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
                                            </div>
                                            <p className="line-clamp-2 text-xs break-keep text-muted-foreground">
                                                {subscription.description}
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant={
                                                isInstalled
                                                    ? "outline"
                                                    : "default"
                                            }
                                            disabled={isInstalled}
                                            onClick={(event) => {
                                                event.preventDefault()
                                                event.stopPropagation()
                                                if (isInstalled) {
                                                    return
                                                }
                                                installSubscription(
                                                    subscription.id
                                                )
                                                setIsSearchOpen(false)
                                                setQuery("")
                                            }}
                                        >
                                            {isInstalled ? "설치됨" : "구독"}
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
