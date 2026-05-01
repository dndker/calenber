"use client"

import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { Button } from "@workspace/ui/components/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@workspace/ui/components/popover"
import { BellIcon } from "lucide-react"
import { useLocale } from "next-intl"
import { NotificationCenterPanel } from "./notification-center-panel"
import { useNotificationCenter } from "./use-notification-center"

interface NotificationDropdownProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

/**
 * nav-actions.tsx 의 Bell 버튼에 연결되는 알림 드롭다운
 */
export function NotificationDropdown({
    open,
    onOpenChange,
}: NotificationDropdownProps) {
    const t = useDebugTranslations("notification")
    const locale = useLocale()
    const {
        digests,
        unreadCount,
        isLoading,
        hasMore,
        loadMoreNotifications,
        markAllRead,
    } = useNotificationCenter({ open })

    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative size-8 data-[state=open]:bg-accent"
                    aria-label={t("dropdown.trigger")}
                >
                    <BellIcon className="size-4.5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-0 right-0 flex size-3.75 items-center justify-center rounded-full bg-primary text-[10px] leading-none font-semibold text-primary-foreground">
                            {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>

            <PopoverContent
                className="w-92 overflow-hidden rounded-2xl border-border/60 p-0 shadow-xl"
                align="end"
            >
                <NotificationCenterPanel
                    title={t("dropdown.title")}
                    emptyTitle={t("dropdown.empty")}
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
                    onItemClick={() => onOpenChange(false)}
                    footerHref="/notifications"
                    footerLabel={t("dropdown.viewAll")}
                    onFooterClick={() => onOpenChange(false)}
                />
            </PopoverContent>
        </Popover>
    )
}
