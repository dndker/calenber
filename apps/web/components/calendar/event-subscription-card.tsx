import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import type { EventSubscriptionItem } from "@/store/calendar-store.types"
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@workspace/ui/components/alert"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import {
    HoverCard,
    HoverCardTrigger,
} from "@workspace/ui/components/hover-card"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { memo } from "react"
import { GoogleCalendarIcon } from "../icon/google-calendar-icon"
import { VerifiedIcon } from "../icon/verified-icon"

export const EventSubscriptionCard = memo(function EventSubscriptionCard({
    subscription,
    className,
    size = "default",
    /** gcal: 이벤트처럼 편집 가능한 구독 이벤트일 때 true — 읽기 전용 배지를 숨긴다 */
    editable = false,
}: {
    subscription: EventSubscriptionItem
    className?: string
    size?: "default" | "sm"
    editable?: boolean
}) {
    const t = useDebugTranslations("event.subscription")
    const isSystem = subscription.authority === "system"
    const isGoogleCalendar = subscription.sourceType === "google_calendar"
    const description = isSystem
        ? null
        : isGoogleCalendar
          ? (subscription.googleEmail ??
            subscription.calendar?.name ??
            subscription.providerName)
          : (subscription.calendar?.name ?? subscription.providerName)

    return (
        <Alert
            className={cn(
                "flex items-center justify-between bg-muted/40 pr-3",
                size === "sm" && "border-0 px-2 py-1.5",
                className
            )}
        >
            <div className="flex flex-1 items-center gap-2.75">
                <HoverCard openDelay={120} closeDelay={80}>
                    <HoverCardTrigger asChild>
                        <Avatar
                            className={cn(
                                "flex size-9 items-center justify-center rounded-lg bg-background after:rounded-lg",
                                size === "sm" && "size-8.5"
                            )}
                        >
                            {isGoogleCalendar ? (
                                <div className="size-5.5">
                                    <GoogleCalendarIcon />
                                </div>
                            ) : (
                                <>
                                    <AvatarImage
                                        src={
                                            isSystem
                                                ? "/symbol.svg"
                                                : (subscription.calendar
                                                      ?.avatarUrl ?? undefined)
                                        }
                                        alt={
                                            subscription.calendar?.name ??
                                            subscription.name
                                        }
                                        className={cn(
                                            "rounded-lg",
                                            isSystem && "size-6 object-none",
                                            size === "sm" && "size-5.5"
                                        )}
                                    />
                                    <AvatarFallback className="rounded-lg bg-background text-base">
                                        {(
                                            subscription.calendar?.name ??
                                            subscription.name
                                        )
                                            .trim()
                                            .charAt(0)
                                            .toUpperCase() || "?"}
                                    </AvatarFallback>
                                </>
                            )}
                        </Avatar>
                    </HoverCardTrigger>
                    {/* <HoverCardContent
                        className="flex w-64 flex-col gap-1.5"
                        side="bottom"
                        align="start"
                    >
                        <div className="flex flex-col gap-0.25">
                            <div className="font-semibold">
                                {subscription.calendar?.name ??
                                    subscription.name}
                            </div>

                            <div className="mt-1 text-xs text-muted-foreground">
                                캘린버에서 공식으로 지원하는 일정입니다.
                            </div>
                        </div>

                        <Button variant="outline" size="sm">
                            캘린더 이동하기
                        </Button>
                    </HoverCardContent> */}
                </HoverCard>
                <div className="flex flex-1 flex-col justify-center gap-px">
                    <AlertTitle
                        className={cn("flex-1", size === "sm" && "text-xs")}
                    >
                        {subscription.name}
                    </AlertTitle>
                    <AlertDescription className="flex items-center gap-0.5 text-xs">
                        {isSystem ? (
                            <>
                                Calenber <VerifiedIcon size="sm" />
                            </>
                        ) : (
                            description
                        )}
                    </AlertDescription>
                </div>
            </div>
            {!editable && (
                <div className="flex shrink-0 items-center justify-center gap-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Badge variant="outline">{t("badge")}</Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <p>{t("readOnly")}</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            )}
        </Alert>
    )
})
