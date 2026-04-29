import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { createReactInlineContentSpec } from "@blocknote/react"
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

// The Mention inline content.
export const Mention = createReactInlineContentSpec(
    {
        type: "mention",
        propSchema: {
            user: {
                default: "Unknown",
            },
            userId: {
                default: "",
            },
            email: {
                default: "",
            },
            avatarUrl: {
                default: "",
            },
        },
        content: "none",
    },
    {
        render: (props) => {
            const t = useDebugTranslations("common.labels")
            const { user, email, avatarUrl } = props.inlineContent.props
            const initial = user?.trim()?.[0]?.toUpperCase() ?? "?"

            return (
                <HoverCard openDelay={10} closeDelay={100}>
                    <HoverCardTrigger asChild>
                        <span className="cursor-default rounded bg-muted-foreground/15 px-1 font-medium">
                            @{user}
                        </span>
                    </HoverCardTrigger>
                    <HoverCardContent
                        className="flex w-auto items-center gap-2 overflow-hidden shadow-sm"
                        align="start"
                        alignOffset={0}
                        sideOffset={5}
                    >
                        <Avatar className="shrink-0">
                            <AvatarImage
                                src={avatarUrl || undefined}
                                alt={user}
                            />
                            <AvatarFallback className="text-sm">
                                {initial}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-1 flex-col gap-1 overflow-hidden text-start">
                            <span className="truncate text-sm font-medium tracking-tight [word-spacing:-1px]">
                                {user}
                            </span>
                            <div className="truncate text-xs text-muted-foreground">
                                {email || t("noEmail")}
                            </div>
                        </div>
                    </HoverCardContent>
                </HoverCard>
            )
        },
    }
)
