import type {
    CalendarMembership,
    CalendarSummary,
    MyCalendarItem,
} from "@/lib/calendar/queries"
import type { CalendarWorkspaceCursor } from "@/lib/calendar/realtime"
import type { CalendarEventLayout } from "@/lib/calendar/types"
import type { PartialBlock } from "@blocknote/core"

export type EditorContent = PartialBlock[]

export const defaultContent: EditorContent = [
    {
        type: "paragraph",
        content: [],
    },
]

export type CalendarEventAuthor = {
    id: string | null
    name: string | null
    email: string | null
    avatarUrl: string | null
}

export type CalendarEventStatus =
    | "scheduled"
    | "in_progress"
    | "completed"
    | "cancelled"

export type CalendarEvent = {
    id: string
    title: string
    content: EditorContent
    start: number
    end: number
    allDay?: boolean
    timezone: string
    color: string
    recurrence?: {
        type: "daily" | "weekly" | "monthly" | "yearly"
        interval: number
        byWeekday?: number[]
        until?: string
        count?: number
    }
    exceptions?: string[]
    status: CalendarEventStatus
    authorId: string | null
    author: CalendarEventAuthor | null
    isLocked: boolean
    createdAt: number
    updatedAt: number
}

export type CalendarEventDraft = Omit<
    CalendarEvent,
    "id" | "createdAt" | "updatedAt" | "authorId" | "author" | "isLocked"
> &
    Partial<Pick<CalendarEvent, "authorId" | "author" | "isLocked">>

export type CalendarWorkspacePresenceMember = {
    id: string
    userId: string | null
    displayName: string
    avatarUrl: string | null
    isAnonymous: boolean
    cursor?: CalendarWorkspaceCursor
}

export type DragMode = "move" | "resize-start" | "resize-end"

export type DragState = {
    eventId: string | null
    mode: DragMode | null
    originStart: number
    originEnd: number
    start: number
    end: number
    offset: number
}

export type SelectionState = {
    isSelecting: boolean
    start: number | null
    end: number | null
}

export type CalendarStoreState = {
    myCalendars: MyCalendarItem[]
    activeCalendar: CalendarSummary | null
    activeCalendarMembership: CalendarMembership
    calendarTimezone: string
    isCalendarLoading: boolean
    activeEventId?: string
    eventLayout: CalendarEventLayout
    selectedDate: number
    viewport: number
    viewportMini: number
    moveRange: { start: number; end: number } | null
    isWorkspacePresenceLoading: boolean
    workspaceCursor: CalendarWorkspaceCursor | null
    workspacePresence: CalendarWorkspacePresenceMember[]
    setMyCalendars: (calendars: MyCalendarItem[]) => void
    setActiveCalendar: (calendar: CalendarSummary | null) => void
    setActiveCalendarMembership: (membership: CalendarMembership) => void
    applyActiveCalendarMembership: (membership: CalendarMembership) => void
    clearActiveCalendarContext: () => void
    updateCalendarSnapshot: (
        calendarId: string,
        patch: Partial<CalendarSummary>
    ) => void
    setCalendarTimezone: (tz: string) => void
    setIsWorkspacePresenceLoading: (isLoading: boolean) => void
    setWorkspaceCursor: (cursor: CalendarWorkspaceCursor | null) => void
    setWorkspacePresence: (
        members: CalendarWorkspacePresenceMember[]
    ) => void
    setIsCalendarLoading: (value: boolean) => void
    setActiveEventId: (eventId?: string) => void
    setEventLayout: (layout: CalendarEventLayout) => void
    setSelectedDate: (date: Date) => void
    setViewportDate: (date: Date) => void
    setViewportMiniDate: (date: Date) => void
    events: CalendarEvent[]
    setEvents: (events: CalendarEvent[]) => void
    upsertEventSnapshot: (event: CalendarEvent) => void
    removeEventSnapshot: (id: string) => void
    createEvent: (data: CalendarEventDraft) => string | null
    updateEvent: (id: string, patch: Partial<CalendarEvent>) => boolean
    deleteEvent: (id: string) => boolean
}

export type CalendarDragState = {
    drag: DragState
    startDrag: (event: CalendarEvent, mode: DragMode, clickedDate: number) => void
    moveDrag: (date: number) => void
    endDrag: () => void
    selection: SelectionState
    startSelection: (date: number) => void
    updateSelection: (date: number) => void
    endSelection: () => void
}
