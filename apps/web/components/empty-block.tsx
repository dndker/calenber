import { FrownIcon, type LucideIcon } from "lucide-react"

import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@workspace/ui/components/empty"
import { cn } from "@workspace/ui/lib/utils"

type EmptyBlockProps = {
    title: string
    description: string
    icon?: LucideIcon
    action?: React.ReactNode
    footer?: React.ReactNode
    className?: string
}

export function EmptyBlock({
    title,
    description,
    icon: Icon = FrownIcon,
    action,
    footer,
    className,
}: EmptyBlockProps) {
    return (
        <Empty className={cn("border", className)}>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Icon />
                </EmptyMedia>
                <EmptyTitle>{title}</EmptyTitle>
                <EmptyDescription>{description}</EmptyDescription>
            </EmptyHeader>
            {action ? (
                <EmptyContent className="flex-row justify-center gap-2">
                    {action}
                </EmptyContent>
            ) : null}
            {footer}
        </Empty>
    )
}
