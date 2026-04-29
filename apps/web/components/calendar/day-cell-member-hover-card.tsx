import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { CalendarWorkspacePresenceMember } from "@/store/calendar-store.types"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@workspace/ui/components/avatar"
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@workspace/ui/components/hover-card"
import { memo, useMemo } from "react"

export const DayCellMemberHoverCard = memo(function DayCellMemberHoverCard({
    cellMembers = [],
    align,
    sideOffset,
    alignOffset,
    children,
}: {
    cellMembers: CalendarWorkspacePresenceMember[]
    align?: "start" | "center" | "end"
    sideOffset?: number
    alignOffset?: number
    children: React.ReactNode
}) {
    const t = useDebugTranslations("common.labels")
    const isCellMember = useMemo(
        () => cellMembers.length > 0,
        [cellMembers.length]
    )
    return (
        <HoverCard openDelay={0} closeDelay={100}>
            <HoverCardTrigger asChild>{children}</HoverCardTrigger>
            {isCellMember && (
                <HoverCardContent
                    align={align}
                    sideOffset={sideOffset}
                    alignOffset={alignOffset}
                    className="scrollbar-hide flex max-h-40 w-auto max-w-44 flex-wrap gap-1.5 overflow-auto px-1.75 py-1.5 shadow-sm"
                >
                    {cellMembers.map((member) => (
                        <div
                            key={member.id}
                            className="flex items-center gap-1"
                        >
                            <Avatar className="size-5">
                                <AvatarImage
                                    src={member.avatarUrl ?? undefined}
                                    alt={member.displayName ?? t("user")}
                                />
                                <AvatarFallback className="text-xs">
                                    {member.displayName?.[0]?.toUpperCase() ??
                                        "?"}
                                </AvatarFallback>
                            </Avatar>

                            {member.displayName}
                        </div>
                    ))}
                </HoverCardContent>
            )}
        </HoverCard>
    )
})
