import type { CalendarMembership } from "@/lib/calendar/queries"
import type { CalendarEvent } from "@/store/calendar-store.types"

export type CalendarRole = "viewer" | "editor" | "manager" | "owner"
export type CalendarAccessMode = "public_open" | "public_approval" | "private"
export type CalendarMemberStatus = "active" | "pending"

export const CALENDAR_ACCESS_MODES = [
    "public_open",
    "public_approval",
    "private",
] as const satisfies readonly CalendarAccessMode[]

function isActiveMember(membership: CalendarMembership) {
    return membership.isMember && membership.status === "active"
}

export function canViewCalendarSettings(membership: CalendarMembership) {
    return isActiveMember(membership)
}

export function canManageCalendar(membership: CalendarMembership) {
    return (
        canViewCalendarSettings(membership) &&
        (membership.role === "manager" || membership.role === "owner")
    )
}

export function canCreateCalendarEvents(membership: CalendarMembership) {
    return (
        canViewCalendarSettings(membership) &&
        (membership.role === "editor" ||
            membership.role === "manager" ||
            membership.role === "owner")
    )
}

export function canEditCalendarEvent(
    event: Pick<CalendarEvent, "authorId" | "isLocked">,
    membership: CalendarMembership,
    userId: string | null | undefined
) {
    if (!canViewCalendarSettings(membership)) {
        return false
    }

    if (membership.role === "manager" || membership.role === "owner") {
        return true
    }

    if (membership.role !== "editor") {
        return false
    }

    if (!event.isLocked) {
        return true
    }

    return Boolean(userId && event.authorId === userId)
}

export function canDeleteCalendarEvent(
    event: Pick<CalendarEvent, "authorId" | "isLocked">,
    membership: CalendarMembership,
    userId: string | null | undefined
) {
    return canEditCalendarEvent(event, membership, userId)
}

export function canToggleCalendarEventLock(
    event: Pick<CalendarEvent, "authorId">,
    membership: CalendarMembership,
    userId: string | null | undefined
) {
    return (
        canManageCalendar(membership) ||
        Boolean(
            canViewCalendarSettings(membership) &&
                userId &&
                event.authorId === userId &&
                (membership.role === "editor" ||
                    membership.role === "manager" ||
                    membership.role === "owner")
        )
    )
}
