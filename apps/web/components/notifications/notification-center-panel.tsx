"use client"

import { EmptyBlock } from "@/components/empty-block"
import type { NotificationDigest } from "@/store/notification-store.types"
import { Button } from "@workspace/ui/components/button"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { BellOffIcon, CheckCheckIcon } from "lucide-react"
import Link from "next/link"
import { NotificationItem } from "./notification-item"

interface NotificationCenterPanelProps {
    title: string
    emptyTitle: string
    summaryText: string
    markAllReadLabel: string
    loadMoreLabel: string
    digests: NotificationDigest[]
    unreadCount: number
    isLoading: boolean
    hasMore: boolean
    onLoadMore: () => void
    onMarkAllRead: () => void
    onItemClick?: () => void
    footerHref?: string
    footerLabel?: string
    onFooterClick?: () => void
    className?: string
    scrollAreaClassName?: string
}

export function NotificationCenterPanel({
    title,
    emptyTitle,
    summaryText,
    markAllReadLabel,
    loadMoreLabel,
    digests,
    unreadCount,
    isLoading,
    hasMore,
    onLoadMore,
    onMarkAllRead,
    onItemClick,
    footerHref,
    footerLabel,
    onFooterClick,
    className,
    scrollAreaClassName,
}: NotificationCenterPanelProps) {
    const showInitialLoading = isLoading && digests.length === 0

    return (
        <Sidebar
            collapsible="none"
            className={cn("min-w-0 bg-transparent dark:bg-muted", className)}
        >
            <SidebarContent className="gap-0 p-0">
                <SidebarGroup className="border-b p-0">
                    <SidebarGroupContent className="p-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">
                                    {title}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {summaryText}
                                </p>
                            </div>

                            {unreadCount > 0 ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto gap-1 px-2 py-1 text-xs"
                                    onClick={onMarkAllRead}
                                >
                                    <CheckCheckIcon className="size-3.5" />
                                    {markAllReadLabel}
                                </Button>
                            ) : null}
                        </div>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup className="min-h-0 flex-1 p-0">
                    <SidebarGroupContent className="h-full">
                        <ScrollArea
                            className={cn(
                                "max-h-[min(32rem,70vh)]",
                                scrollAreaClassName
                            )}
                        >
                            {showInitialLoading ? (
                                <div className="flex items-center justify-center px-4 py-12">
                                    <Spinner className="size-5" />
                                </div>
                            ) : digests.length === 0 ? (
                                <div className="px-4 py-8">
                                    <EmptyBlock
                                        icon={BellOffIcon}
                                        title={emptyTitle}
                                    />
                                </div>
                            ) : (
                                <div className="p-2">
                                    <SidebarMenu className="gap-1">
                                        {digests.map((digest) => (
                                            <NotificationItem
                                                key={digest.digestKey}
                                                digest={digest}
                                                onClick={onItemClick}
                                            />
                                        ))}
                                    </SidebarMenu>

                                    {hasMore ? (
                                        <div className="px-1 pt-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="w-full"
                                                disabled={isLoading}
                                                onClick={onLoadMore}
                                            >
                                                {isLoading ? (
                                                    <Spinner className="size-4" />
                                                ) : (
                                                    loadMoreLabel
                                                )}
                                            </Button>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </ScrollArea>
                    </SidebarGroupContent>
                </SidebarGroup>

                {footerHref && footerLabel ? (
                    <SidebarGroup className="border-t p-0">
                        <SidebarGroupContent className="p-2">
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild className="h-9">
                                        <Link
                                            href={footerHref}
                                            onClick={onFooterClick}
                                        >
                                            <span>{footerLabel}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                ) : null}
            </SidebarContent>
        </Sidebar>
    )
}
