import { cn } from "@workspace/ui/lib/utils"

export const calendarCollectionColors = [
    "blue",
    "green",
    "sky",
    "purple",
    "red",
    "orange",
    "yellow",
    "gray",
    "olive",
    "pink",
    "brown",
] as const

export type CalendarCollectionColor = (typeof calendarCollectionColors)[number]

export const calendarCollectionColorLabels: Record<
    CalendarCollectionColor,
    string
> = {
    blue: "Blue",
    green: "Green",
    sky: "Sky",
    purple: "Purple",
    red: "Red",
    orange: "Orange",
    yellow: "Yellow",
    gray: "Gray",
    olive: "Olive",
    pink: "Pink",
    brown: "Brown",
}

export function isCalendarCollectionColor(
    color: string | null | undefined
): color is CalendarCollectionColor {
    return calendarCollectionColors.includes(color as CalendarCollectionColor)
}

export function normalizeCalendarCollectionColor(
    color: string | null | undefined
): CalendarCollectionColor | undefined {
    return isCalendarCollectionColor(color) ? color : undefined
}

export function randomCalendarCollectionColor() {
    return calendarCollectionColors[
        Math.floor(Math.random() * calendarCollectionColors.length)
    ] as CalendarCollectionColor
}

export function getCalendarCollectionLabelClassName(
    color: string | null | undefined,
    className?: string
) {
    const normalizedColor = normalizeCalendarCollectionColor(color)

    return cn(
        normalizedColor ? `cb-label-${normalizedColor}` : undefined,
        className
    )
}

export function getCalendarCollectionPaletteClassName(
    color: string | null | undefined,
    className?: string
) {
    const normalizedColor = normalizeCalendarCollectionColor(color)

    return cn(
        normalizedColor ? `cb-palette-${normalizedColor}` : undefined,
        className
    )
}

export function getCalendarCollectionDotClassName(
    color: string | null | undefined,
    className?: string
) {
    const normalizedColor = normalizeCalendarCollectionColor(color)

    return cn(
        normalizedColor ? `cb-dot-${normalizedColor}` : undefined,
        className
    )
}

export function getCalendarCollectionEventClassName(
    color: string | null | undefined,
    className?: string
) {
    const normalizedColor = normalizeCalendarCollectionColor(color)

    return cn(
        normalizedColor ? `cb-event-${normalizedColor}` : undefined,
        className
    )
}

export function getCalendarCollectionEventHoverClassName(
    color: string | null | undefined,
    className?: string
) {
    const normalizedColor = normalizeCalendarCollectionColor(color)

    return cn(
        normalizedColor ? `cb-event-hover-${normalizedColor}` : undefined,
        className
    )
}

export function getCalendarCollectionCheckboxClassName(
    color: string | null | undefined,
    className?: string
) {
    const normalizedColor = normalizeCalendarCollectionColor(color)

    return cn(
        normalizedColor ? `cb-checkbox-${normalizedColor}` : undefined,
        className
    )
}
