import type { CalendarCollectionColor } from "@/lib/calendar/collection-color"
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

export type CalendarEventParticipant = {
    id: string
    eventId: string
    userId: string
    role: "participant"
    createdAt: number
    user: {
        id: string
        name: string | null
        email: string | null
        avatarUrl: string | null
    }
}

export type CalendarEventRecurrence = {
    type: "daily" | "weekly" | "monthly" | "yearly"
    interval: number
    byWeekday?: number[]
    until?: string
    count?: number
}

export type CalendarEventRecurrenceInstance = {
    key: string
    sourceEventId: string
    sourceStart: number
    sourceEnd: number
    occurrenceStart: number
    occurrenceEnd: number
}

export type CalendarEventCollection = {
    id: string
    calendarId: string
    name: string
    options: {
        visibleByDefault: boolean
        color?: CalendarCollectionColor
    }
    createdById: string | null
    createdAt: number
    updatedAt: number
}

export const calendarEventFieldIds = [
    "schedule",
    "participants",
    "collections",
    "status",
    "recurrence",
    "exceptions",
    "timezone",
    "place",
    "notification",
] as const

export type CalendarEventFieldId = (typeof calendarEventFieldIds)[number]

export type CalendarEventFieldSettings = {
    version: 1
    items: {
        id: CalendarEventFieldId
        visible: boolean
    }[]
}

export const eventStatusTranslationKey = {
    scheduled: "scheduled",
    in_progress: "inProgress",
    completed: "done",
    cancelled: "cancelled",
} as const

export const eventStatus = [
    "scheduled",
    "in_progress",
    "completed",
    "cancelled",
] as const

export type CalendarEventStatus = (typeof eventStatus)[number]

export type CalendarEventFilterState = {
    excludedStatuses: CalendarEventStatus[]
    excludedCollectionIds: string[]
    excludedWithoutCollection: boolean
}

export type CalendarSubscriptionAuthority = "system" | "admin" | "user"
export type CalendarSubscriptionSourceType =
    | "system_holiday"
    | "shared_collection"
    | "custom"

export type CalendarSubscriptionCalendarInfo = {
    id: string | null
    name: string | null
    avatarUrl: string | null
}

export type CalendarSubscriptionDefinition = {
    id: string
    slug?: string
    name: string
    description: string
    authority: CalendarSubscriptionAuthority
    ownerName: string
    verified: boolean
    tags: string[]
    collectionColor?: CalendarCollectionColor
    sourceType?: CalendarSubscriptionSourceType
    status?: "active" | "source_deleted" | "archived"
    sourceDeletedAt?: string | null
    sourceDeletedReason?: string | null
    providerName?: string | null
    calendar?: CalendarSubscriptionCalendarInfo | null
    config?: Record<string, unknown>
    /** 구독 공개 범위. shared_collection 타입에서만 의미 있음. */
    visibility?: "public" | "unlisted" | null
}

export type CalendarSubscriptionState = {
    installedSubscriptionIds: string[]
    hiddenSubscriptionIds: string[]
}

export type CalendarSubscriptionCatalogItem = CalendarSubscriptionDefinition

export type EventSubscriptionItem = {
    id: string
    slug?: string
    name: string
    sourceType?: CalendarSubscriptionSourceType
    authority?: CalendarSubscriptionAuthority
    providerName?: string | null
    calendar?: CalendarSubscriptionCalendarInfo | null
}

export type CalendarEvent = {
    id: string
    title: string
    content: EditorContent
    start: number
    end: number
    allDay?: boolean
    timezone: string
    collectionIds: string[]
    collections: CalendarEventCollection[]
    primaryCollectionId: string | null
    primaryCollection: CalendarEventCollection | null
    recurrence?: CalendarEventRecurrence
    recurrenceInstance?: CalendarEventRecurrenceInstance
    exceptions?: string[]
    participants: CalendarEventParticipant[]
    isFavorite: boolean
    favoritedAt: number | null
    status: CalendarEventStatus
    authorId: string | null
    author: CalendarEventAuthor | null
    updatedById: string | null
    updatedBy: CalendarEventAuthor | null
    subscription?: EventSubscriptionItem
    isLocked: boolean
    createdAt: number
    updatedAt: number
}

export type CalendarEventDraft = Omit<
    CalendarEvent,
    | "id"
    | "createdAt"
    | "updatedAt"
    | "authorId"
    | "author"
    | "updatedById"
    | "updatedBy"
    | "isLocked"
> &
    Partial<
        Pick<
            CalendarEvent,
            | "id"
            | "createdAt"
            | "updatedAt"
            | "authorId"
            | "author"
            | "updatedById"
            | "updatedBy"
            | "isLocked"
        >
    >

export type CalendarEventPatch = Omit<Partial<CalendarEvent>, "recurrence"> & {
    recurrence?: CalendarEventRecurrence | null
}

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
    renderId: string | null
    mode: DragMode | null
    originStart: number
    originEnd: number
    sourceOriginStart: number
    sourceOriginEnd: number
    start: number
    end: number
    offset: number
    segmentOffset: number
    /** 리사이즈 시작 시점의 주간 레인(행). 드래그 중에는 이 레인에 고정해 겹치는 다른 일정만 재배치한다. */
    resizePinnedLane: number | null
    /** `resizePinnedLane`이 적용되는 주의 시작일(캘린더 day 값, `toCalendarDay`와 동일 스케일). */
    resizeLayoutWeekStart: number | null
    /** 리사이즈 중 어떤 핸들을 잡았는지(시작일=왼쪽, 종료일=오른쪽). 핸들 하이라이트에 사용 */
    resizeActiveEdge: "start" | "end" | null
    previewEvent: CalendarEvent | null
    baseHoveredDateKeys: string[]
    hoveredDateKeys: string[]
}

export type SelectionState = {
    isSelecting: boolean
    anchor: number | null
    start: number | null
    end: number | null
}

export type CalendarStoreState = {
    myCalendars: MyCalendarItem[]
    activeCalendar: CalendarSummary | null
    activeCalendarMembership: CalendarMembership
    favoriteEventMap: Record<string, number | null>
    calendarTimezone: string
    isCalendarLoading: boolean
    activeEventId?: string
    viewEvent: CalendarEvent | null
    eventLayout: CalendarEventLayout
    selectedDate: number
    viewport: number
    viewportMini: number
    moveRange: { start: number; end: number } | null
    isWorkspacePresenceLoading: boolean
    workspaceCursor: CalendarWorkspaceCursor | null
    workspacePresence: CalendarWorkspacePresenceMember[]
    eventCollections: CalendarEventCollection[]
    eventFilters: CalendarEventFilterState
    subscriptionCatalogs: CalendarSubscriptionCatalogItem[]
    subscriptionState: CalendarSubscriptionState
    hoveredSeriesEventId: string | null
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
    setWorkspacePresence: (members: CalendarWorkspacePresenceMember[]) => void
    setEventCollections: (collections: CalendarEventCollection[]) => void
    toggleEventStatusFilter: (status: CalendarEventStatus) => void
    toggleEventCollectionFilter: (collectionId: string) => void
    setExcludedWithoutCollectionFilter: (excluded: boolean) => void
    setSubscriptionState: (state: CalendarSubscriptionState) => void
    setSubscriptionCatalogs: (
        catalogs: CalendarSubscriptionCatalogItem[]
    ) => void
    installSubscription: (subscriptionId: string) => void
    uninstallSubscription: (subscriptionId: string) => void
    toggleSubscriptionVisibility: (subscriptionId: string) => void
    resetEventFilters: () => void
    setHoveredSeriesEventId: (eventId: string | null) => void
    upsertEventCollectionSnapshot: (collection: CalendarEventCollection) => void
    removeEventCollectionSnapshot: (collectionId: string) => void
    setEventCollectionDefaultVisibility: (
        collectionId: string,
        visibleByDefault: boolean
    ) => void
    setIsCalendarLoading: (value: boolean) => void
    setActiveEventId: (eventId?: string) => void
    setViewEvent: (event: CalendarEvent | null) => void
    setEventLayout: (layout: CalendarEventLayout) => void
    setSelectedDate: (date: Date) => void
    setViewportDate: (date: Date) => void
    setViewportMiniDate: (date: Date) => void
    events: CalendarEvent[]
    setEvents: (events: CalendarEvent[]) => void
    upsertEventSnapshot: (event: CalendarEvent) => void
    toggleEventFavorite: (id: string, nextValue?: boolean) => Promise<boolean>
    removeEventSnapshot: (id: string) => void
    createEvent: (data: CalendarEventDraft) => string | null
    updateEvent: (
        id: string,
        patch: CalendarEventPatch,
        options?: {
            expectedUpdatedAt?: number
        }
    ) => boolean
    deleteEvent: (id: string) => boolean
}

export type CalendarDragState = {
    drag: DragState
    startDrag: (
        event: CalendarEvent,
        mode: DragMode,
        clickedDate: number,
        options?: {
            segmentOffset?: number
            resizePinnedLane?: number | null
            resizeLayoutWeekStart?: number | null
        }
    ) => void
    moveDrag: (date: number) => void
    endDrag: () => void
    selection: SelectionState
    startSelection: (date: number) => void
    updateSelection: (date: number) => void
    endSelection: () => void
}
