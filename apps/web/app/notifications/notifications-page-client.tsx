"use client"

import { NotificationCenterPanel } from "@/components/notifications/notification-center-panel"
import { useNotificationCenter } from "@/components/notifications/use-notification-center"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import type { NotificationDigest } from "@/store/notification-store.types"
import { Button } from "@workspace/ui/components/button"
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import { BellIcon, CheckCheckIcon, SparklesIcon } from "lucide-react"
import { useLocale } from "next-intl"

interface NotificationsPageClientProps {
    initialDigests: NotificationDigest[]
    initialHasMore: boolean
}

export function NotificationsPageClient({
    initialDigests,
    initialHasMore,
}: NotificationsPageClientProps) {
    const t = useDebugTranslations("notification")
    const locale = useLocale()
    const {
        digests,
        unreadCount,
        isLoading,
        hasMore,
        loadMoreNotifications,
        markAllRead,
    } = useNotificationCenter({
        initialDigests,
        initialHasMore,
    })

    return (
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
            <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
                <Sidebar
                    collapsible="none"
                    className="rounded-3xl border border-border/60 bg-gradient-to-b from-muted/70 via-background to-background shadow-sm"
                >
                    <SidebarContent className="gap-0 p-0">
                        <SidebarGroup className="border-b p-0">
                            <SidebarGroupContent className="space-y-3 p-5">
                                <div className="flex items-center gap-3">
                                    <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                        <BellIcon className="size-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h1 className="text-xl font-semibold">
                                            {t("page.title")}
                                        </h1>
                                        <p className="text-sm text-muted-foreground">
                                            Stay on top of changes across your
                                            calendars.
                                        </p>
                                    </div>
                                </div>

                                {unreadCount > 0 ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full gap-1.5"
                                        onClick={markAllRead}
                                    >
                                        <CheckCheckIcon className="size-4" />
                                        {t("dropdown.markAllRead")}
                                    </Button>
                                ) : null}
                            </SidebarGroupContent>
                        </SidebarGroup>

                        <SidebarGroup className="p-0">
                            <SidebarGroupContent className="p-3">
                                <SidebarMenu className="gap-2">
                                    <SidebarMenuItem>
                                        <SidebarMenuButton
                                            className="h-auto items-start rounded-2xl border border-border/60 bg-background/80 px-3 py-3"
                                            isActive
                                        >
                                            <SparklesIcon className="mt-0.5 size-4 text-primary" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium">
                                                    {locale === "ko"
                                                        ? `읽지 않은 알림 ${unreadCount}개`
                                                        : `${unreadCount} unread notifications`}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {locale === "ko"
                                                        ? "새로운 변경 사항이 실시간으로 여기에 쌓입니다."
                                                        : "New updates are surfaced here in real time."}
                                                </p>
                                            </div>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    </SidebarContent>
                </Sidebar>

                <NotificationCenterPanel
                    title={t("page.title")}
                    emptyTitle={t("page.empty")}
                    summaryText={
                        unreadCount > 0
                            ? locale === "ko"
                                ? `읽지 않은 알림 ${unreadCount}개`
                                : `${unreadCount} unread notifications`
                            : locale === "ko"
                              ? `전체 알림 ${digests.length}개`
                              : `${digests.length} notifications`
                    }
                    markAllReadLabel={t("dropdown.markAllRead")}
                    loadMoreLabel={t("dropdown.loadMore")}
                    digests={digests}
                    unreadCount={unreadCount}
                    isLoading={isLoading}
                    hasMore={hasMore}
                    onLoadMore={loadMoreNotifications}
                    onMarkAllRead={markAllRead}
                    className="rounded-3xl border border-border/60 bg-background/90 shadow-sm"
                    scrollAreaClassName="max-h-none h-[min(70vh,52rem)]"
                />
            </div>
        </div>
    )
}
