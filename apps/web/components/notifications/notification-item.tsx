"use client"

import { navigateCalendarModal } from "@/lib/calendar/modal-navigation"
import {
    formatNotificationBody,
    resolveNotificationAvatar,
    resolveNotificationHref,
} from "@/lib/notification/format"
import type { NotificationDigest } from "@/store/notification-store.types"
import { useNotificationStore } from "@/store/useNotificationStore"
import {
    SidebarMenuButton,
    SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import { cn } from "@workspace/ui/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { ko } from "date-fns/locale"
import type { MouseEvent } from "react"
import { useLocale } from "next-intl"
import Link from "next/link"
import { NotificationAvatar } from "./notification-avatar"

interface NotificationItemProps {
    digest: NotificationDigest
    onClick?: () => void
}

export function NotificationItem({ digest, onClick }: NotificationItemProps) {
    const locale = useLocale()
    const markRead = useNotificationStore((s) => s.markRead)

    const avatarSource = resolveNotificationAvatar(digest)
    const href = resolveNotificationHref(digest)

    const bodyText = formatNotificationBody(digest, () => {
        // formatNotificationBody 내부에서 t() 사용 불가능하므로 인라인 처리
        return buildBodyText(digest, locale)
    })

    const timeText = formatDistanceToNow(new Date(digest.lastOccurredAt), {
        addSuffix: true,
        locale: locale === "ko" ? ko : undefined,
    })

    async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
        if (!digest.isRead) {
            await markRead([digest.digestKey])
        }

        if (digest.entityType === "event" && digest.calendarId) {
            event.preventDefault()
            navigateCalendarModal(href)
        }

        onClick?.()
    }

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                asChild
                className={cn(
                    "h-auto items-start gap-3 rounded-xl px-3 py-3",
                    !digest.isRead && "bg-sidebar-accent/70"
                )}
            >
                <Link href={href} onClick={handleClick}>
                    <div className="relative mt-0.5 shrink-0">
                        <NotificationAvatar source={avatarSource} />
                        {!digest.isRead && (
                            <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary" />
                        )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm leading-snug">
                            {digest.metadata.title ? (
                                <span className="font-medium text-foreground">
                                    {digest.metadata.title}{" "}
                                </span>
                            ) : null}
                            <span className="text-muted-foreground">
                                {bodyText}
                            </span>
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{timeText}</span>
                            {digest.count > 1 ? (
                                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground">
                                    {digest.count}
                                </span>
                            ) : null}
                        </div>
                    </div>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    )
}

/**
 * digest 데이터로 직접 본문 텍스트를 구성한다 (i18n 훅 밖에서도 사용 가능하도록).
 * 실제 다국어 대응은 locale 분기로 처리.
 */
function buildBodyText(digest: NotificationDigest, locale: string): string {
    const { notificationType, metadata, count } = digest
    const actor = metadata.actorName ?? "알 수 없는 사용자"
    const others = Math.max(0, count - 1)
    const isKo = locale === "ko"

    function withOthers(single: string, multi: (n: number) => string): string {
        return others === 0 ? single : multi(others)
    }

    switch (notificationType) {
        case "calendar_joined":
            return withOthers(
                isKo
                    ? `${actor}님이 캘린더에 가입했습니다`
                    : `${actor} joined the calendar`,
                (n) =>
                    isKo
                        ? `${actor}님 외 ${n}명이 캘린더에 가입했습니다`
                        : `${actor} and ${n} others joined the calendar`
            )
        case "calendar_settings_changed":
            return withOthers(
                isKo
                    ? `${actor}님이 캘린더 설정을 변경했습니다`
                    : `${actor} updated calendar settings`,
                (n) =>
                    isKo
                        ? `${actor}님 외 ${n}명이 캘린더 설정을 변경했습니다`
                        : `${actor} and ${n} others updated calendar settings`
            )
        case "event_created":
            return isKo
                ? `${actor}님이 일정을 추가했습니다`
                : `${actor} created an event`
        case "event_updated":
            return isKo
                ? `${actor}님이 일정을 수정했습니다`
                : `${actor} updated the event`
        case "event_deleted":
            return isKo
                ? `${actor}님이 일정을 삭제했습니다`
                : `${actor} deleted the event`
        case "event_tagged":
            return isKo
                ? `${actor}님이 이 일정에서 회원님을 언급했습니다`
                : `${actor} mentioned you in an event`
        case "event_participant_added":
            return isKo
                ? `${actor}님이 회원님을 일정 참가자로 추가했습니다`
                : `${actor} added you as a participant`
        case "event_comment_added":
            return isKo
                ? `${actor}님이 일정에 댓글을 달았습니다`
                : `${actor} commented on the event`
        case "event_comment_replied":
            return isKo
                ? `${actor}님이 댓글에 답글을 달았습니다`
                : `${actor} replied to your comment`
        case "event_reaction":
            return isKo ? `${actor}님이 반응을 남겼습니다` : `${actor} reacted`
        default:
            return isKo ? "새 알림이 있습니다" : "New notification"
    }
}
