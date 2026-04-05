import { memo } from "react"

export const MonthHeader = memo(() => {
    return (
        <div className="flex shrink-0 gap-px border-b border-border/65">
            {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                <div
                    key={d}
                    className="flex-1 bg-background px-3 py-2 text-right text-sm font-medium text-muted-foreground"
                >
                    <span className="inline-block w-8 text-center">{d}</span>
                </div>
            ))}
        </div>
    )
})

MonthHeader.displayName = "MonthHeader"
