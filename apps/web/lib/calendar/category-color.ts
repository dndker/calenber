import { cn } from "@workspace/ui/lib/utils"

export const calendarCategoryColors = [
    "blue",
    "green",
    "sky",
    "purple",
    "red",
    "yellow",
    "gray",
    "olive",
    "pink",
    "mauve",
] as const

export type CalendarCategoryColor = (typeof calendarCategoryColors)[number]

export const calendarCategoryColorLabels: Record<
    CalendarCategoryColor,
    string
> = {
    blue: "Blue",
    green: "Green",
    sky: "Sky",
    purple: "Purple",
    red: "Red",
    yellow: "Yellow",
    gray: "Gray",
    olive: "Olive",
    pink: "Pink",
    mauve: "Mauve",
}

export function isCalendarCategoryColor(
    color: string | null | undefined
): color is CalendarCategoryColor {
    return calendarCategoryColors.includes(color as CalendarCategoryColor)
}

export function normalizeCalendarCategoryColor(
    color: string | null | undefined
): CalendarCategoryColor | undefined {
    return isCalendarCategoryColor(color) ? color : undefined
}

export function randomCalendarCategoryColor() {
    return calendarCategoryColors[
        Math.floor(Math.random() * calendarCategoryColors.length)
    ] as CalendarCategoryColor
}

export function getCalendarCategoryLabelClassName(
    color: string | null | undefined,
    className?: string
) {
    const normalizedColor = normalizeCalendarCategoryColor(color)

    return cn(
        normalizedColor ? `cb-label-${normalizedColor}` : undefined,
        className
    )
}

export function getCalendarCategoryPaletteClassName(
    color: string | null | undefined,
    className?: string
) {
    const normalizedColor = normalizeCalendarCategoryColor(color)

    return cn(
        normalizedColor ? `cb-palette-${normalizedColor}` : undefined,
        className
    )
}

export function getCalendarCategoryDotClassName(
    color: string | null | undefined,
    className?: string
) {
    const normalizedColor = normalizeCalendarCategoryColor(color)

    return cn(
        normalizedColor ? `cb-dot-${normalizedColor}` : undefined,
        className
    )
}

export function getCalendarCategoryEventClassName(
    color: string | null | undefined,
    className?: string
) {
    const normalizedColor = normalizeCalendarCategoryColor(color)

    return cn(
        normalizedColor ? `cb-event-${normalizedColor}` : undefined,
        className
    )
}

export function getCalendarCategoryCheckboxClassName(
    color: string | null | undefined,
    className?: string
) {
    const normalizedColor = normalizeCalendarCategoryColor(color)

    return cn(
        normalizedColor ? `cb-checkbox-${normalizedColor}` : undefined,
        className
    )
}
