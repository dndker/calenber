import { cn } from "@workspace/ui/lib/utils"
import { BadgeCheckIcon } from "lucide-react"

export function VerifiedIcon({
    className,
    size = "default",
}: {
    className?: string
    size?: "default" | "sm" | "lg"
}) {
    return (
        <BadgeCheckIcon
            className={cn(
                "size-3.5 text-blue-500",
                size === "sm" && "size-3.25!",
                size === "lg" && "size-4",
                className
            )}
        />
    )
}
