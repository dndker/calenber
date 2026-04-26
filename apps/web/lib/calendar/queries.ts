import {
    mapCalendarEventRecordToCalendarEvent,
    type CalendarEventRecord,
} from "@/lib/calendar/event-record"
import { normalizeCalendarEventFieldSettings } from "@/lib/calendar/event-field-settings"
import { normalizeCalendarLayoutOptions } from "@/lib/calendar/layout-options"
import { normalizeCalendarCategoryColor } from "@/lib/calendar/category-color"
import { isCalendarEventUuid } from "@/lib/calendar/event-id"
import { parseEventContent } from "@/lib/calendar/event-content"
import type {
    CalendarSubscriptionCatalogItem,
    CalendarEvent,
    CalendarEventFieldSettings,
} from "@/store/calendar-store.types"
import type {
    CalendarAccessMode,
    CalendarMemberStatus,
    CalendarRole,
} from "@/lib/calendar/permissions"
import type { CalendarEventLayout } from "@/lib/calendar/types"
import type { SupabaseClient } from "@supabase/supabase-js"

const CALENDAR_MEMBER_DIRECTORY_CACHE_TTL_MS = 30_000

const calendarMemberDirectoryCache = new Map<
    string,
    {
        fetchedAt: number
        data: CalendarMemberDirectoryItem[]
        promise?: Promise<CalendarMemberDirectoryItem[]>
    }
>()

export type CalendarSummary = {
    id: string
    name: string
    avatarUrl: string | null
    accessMode: CalendarAccessMode
    eventLayout: CalendarEventLayout
    eventFieldSettings: CalendarEventFieldSettings
    layoutOptions: ReturnType<typeof normalizeCalendarLayoutOptions>
    updatedAt: string
    createdAt: string
}

export type MyCalendarItem = CalendarSummary & {
    role: CalendarRole | null
}

export type DiscoverCalendarItem = CalendarSummary & {
    memberCount: number
    creatorId: string | null
    creatorName: string | null
    creatorEmail: string | null
    creatorAvatarUrl: string | null
}

export type CalendarMembership = {
    isMember: boolean
    role: CalendarRole | null
    status: CalendarMemberStatus | null
}

export type CalendarEventMetadata = {
    id: string
    title: string
    content: CalendarEvent["content"]
    start: number
    end: number
    status: CalendarEvent["status"]
    author: {
        name: string | null
    } | null
}

export type CalendarEventParticipantDirectoryItem = {
    id: string
    eventId: string
    userId: string
    role: "participant"
    createdAt: string
    email: string | null
    name: string | null
    avatarUrl: string | null
}

export type CalendarMemberDirectoryItem = {
    id: string
    userId: string
    role: CalendarRole
    status: CalendarMemberStatus
    createdAt: string
    email: string | null
    name: string | null
    avatarUrl: string | null
}

export type CalendarEventCategorySummary = {
    id: string
    calendarId: string
    name: string
    options: {
        visibleByDefault: boolean
        color: CalendarEvent["categories"][number]["options"]["color"]
    }
    createdById: string | null
    createdAt: string
    updatedAt: string
}

export type CalendarInitialData = {
    calendar: CalendarSummary | null
    membership: CalendarMembership
    myCalendars: MyCalendarItem[]
    eventCategories: CalendarEventCategorySummary[]
    events: CalendarEvent[]
    subscriptionCatalogs: CalendarSubscriptionCatalogItem[]
    subscriptionState: {
        installedSubscriptionIds: string[]
        hiddenSubscriptionIds: string[]
    }
    subscriptionFavoriteEventIds: Array<{
        eventId: string
        favoritedAt: number
    }>
}

export type CalendarSubscriptionCatalog = {
    id: string
    slug: string
    name: string
    description: string
    sourceType: "system_holiday" | "shared_category" | "custom"
    verified: boolean
    status: "active" | "source_deleted" | "archived"
    sourceDeletedAt: string | null
    sourceDeletedReason: string | null
    providerName: string | null
    sourceCalendarId: string | null
    sourceCalendarName: string | null
    categoryColor: CalendarEvent["categories"][number]["options"]["color"] | null
    config: Record<string, unknown>
    installed: boolean
    isVisible: boolean
}

type CalendarRow = {
    id: string
    name: string
    avatar_url: string | null
    access_mode: CalendarAccessMode
    event_layout: CalendarEventLayout
    event_field_settings: unknown
    layout_options: unknown
    updated_at: string
    created_at: string
    calendar_members:
        | {
              role: CalendarRole | null
              status: CalendarMemberStatus | null
          }[]
        | null
}

type DiscoverCalendarRow = {
    id: string
    name: string
    avatar_url: string | null
    access_mode: CalendarAccessMode
    event_layout: CalendarEventLayout
    event_field_settings: unknown
    layout_options: unknown
    updated_at: string
    created_at: string
    member_count: number
    creator_user_id: string | null
    creator_name: string | null
    creator_email: string | null
    creator_avatar_url: string | null
}

type CalendarMemberDirectoryRow = {
    id: string
    user_id: string
    role: CalendarRole
    status: CalendarMemberStatus
    created_at: string
    email: string | null
    name: string | null
    avatar_url: string | null
}

type CalendarEventWithCalendarRow = {
    id: string
    title: string
    content: CalendarEvent["content"] | string | null
    start_at: string | null
    end_at: string | null
    categories: CalendarEvent["categories"] | null
    category_id: string | null
    recurrence: CalendarEvent["recurrence"] | null
    exceptions: CalendarEvent["exceptions"] | null
    participants: CalendarEvent["participants"] | null
    status: CalendarEvent["status"] | null
    created_by: string | null
    updated_by: string | null
    is_locked: boolean | null
    created_at: string
    updated_at: string | null
    event_categories: {
        id: string
        calendar_id: string
        name: string
        options: {
            visibleByDefault?: boolean
            color?: CalendarEvent["categories"][number]["options"]["color"]
        } | null
        created_by: string | null
        created_at: string
        updated_at: string
    } | null
    event_participants:
        | {
              id: string
              event_id: string
              user_id: string
              role: "participant"
              created_at: string
              users: {
                  email: string | null
                  raw_user_meta_data: {
                      name?: string | null
                      avatar_url?: string | null
                  } | null
              } | null
          }[]
        | null
    calendars: {
        id: string
        name: string
        avatar_url: string | null
        access_mode: CalendarAccessMode
        event_layout: CalendarEventLayout
        event_field_settings: unknown
        layout_options: unknown
        updated_at: string
        created_at: string
    } | null
}

type CalendarEventCategoryRow = {
    id: string
    calendar_id: string
    name: string
    options: {
        visibleByDefault?: boolean
        color?: CalendarEvent["categories"][number]["options"]["color"]
    } | null
    created_by: string | null
    created_at: string
    updated_at: string
}

type CalendarInitialDataPayload = {
    calendar: CalendarSummary | null
    membership: CalendarMembership | null
    myCalendars: MyCalendarItem[] | null
    eventCategories: CalendarEventCategorySummary[] | null
    events: CalendarEventRecord[] | null
}

type CalendarSubscriptionCatalogRow = {
    id: string
    slug: string
    name: string
    description: string
    source_type: "system_holiday" | "shared_category" | "shared_calendar" | "custom"
    verified: boolean
    status: "active" | "source_deleted" | "archived"
    source_deleted_at: string | null
    source_deleted_reason: string | null
    provider_name: string | null
    source_calendar_id: string | null
    source_calendar_name: string | null
    category_color: string | null
    config: Record<string, unknown> | null
    installed: boolean
    is_visible: boolean
}

function normalizeCalendarSubscriptionSourceType(
    sourceType: CalendarSubscriptionCatalogRow["source_type"]
): CalendarSubscriptionCatalog["sourceType"] {
    if (sourceType === "shared_calendar") {
        return "custom"
    }

    return sourceType
}

type CalendarSubscriptionFavoriteRow = {
    event_id: string
    created_at: string
}

function normalizeCalendarMembership(
    membership: CalendarMembership | null | undefined
): CalendarMembership {
    return {
        isMember: membership?.isMember === true,
        role: membership?.role ?? null,
        status: membership?.status ?? null,
    }
}

function normalizeCalendarSummary(
    calendar: CalendarSummary | null | undefined
): CalendarSummary | null {
    if (!calendar) {
        return null
    }

    return {
        ...calendar,
        eventFieldSettings: normalizeCalendarEventFieldSettings(
            calendar.eventFieldSettings
        ),
        layoutOptions: normalizeCalendarLayoutOptions(calendar.layoutOptions),
    }
}

function normalizeMyCalendarItem(calendar: MyCalendarItem): MyCalendarItem {
    return {
        ...calendar,
        eventFieldSettings: normalizeCalendarEventFieldSettings(
            calendar.eventFieldSettings
        ),
        layoutOptions: normalizeCalendarLayoutOptions(calendar.layoutOptions),
    }
}

function normalizeCalendarEventCategorySummary(
    category: CalendarEventCategorySummary | CalendarEventCategoryRow
): CalendarEventCategorySummary {
    const calendarId =
        "calendarId" in category ? category.calendarId : category.calendar_id
    const createdById =
        "createdById" in category ? category.createdById : category.created_by
    const createdAt =
        "createdAt" in category ? category.createdAt : category.created_at
    const updatedAt =
        "updatedAt" in category ? category.updatedAt : category.updated_at

    return {
        id: category.id,
        calendarId,
        name: category.name,
        options: {
            visibleByDefault: category.options?.visibleByDefault !== false,
            color: normalizeCalendarCategoryColor(category.options?.color),
        },
        createdById,
        createdAt,
        updatedAt,
    }
}

export async function getAllCalendars(
    supabase: SupabaseClient
): Promise<DiscoverCalendarItem[]> {
    const { data, error } = await supabase.rpc("get_discover_calendars")

    if (error || !data) {
        console.error("Failed to load calendars:", error)
        return []
    }

    return (data as DiscoverCalendarRow[]).map((calendar) => ({
        id: calendar.id,
        name: calendar.name,
        avatarUrl: calendar.avatar_url,
        accessMode: calendar.access_mode,
        eventLayout: calendar.event_layout,
        eventFieldSettings: normalizeCalendarEventFieldSettings(
            calendar.event_field_settings
        ),
        layoutOptions: normalizeCalendarLayoutOptions(calendar.layout_options),
        updatedAt: calendar.updated_at,
        createdAt: calendar.created_at,
        memberCount: calendar.member_count,
        creatorId: calendar.creator_user_id,
        creatorName: calendar.creator_name,
        creatorEmail: calendar.creator_email,
        creatorAvatarUrl: calendar.creator_avatar_url,
    }))
}

export async function getMyCalendars(
    supabase: SupabaseClient,
    userId: string
): Promise<MyCalendarItem[]> {
    const { data, error } = await supabase
        .from("calendars")
        .select(
            "id, name, avatar_url, access_mode, event_layout, event_field_settings, layout_options, updated_at, created_at, calendar_members!inner(role, status)"
        )
        .eq("calendar_members.user_id", userId)
        .eq("calendar_members.status", "active")
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: true })

    if (error || !data) {
        console.error("Failed to load calendars:", error)
        return []
    }

    return (data as unknown as CalendarRow[]).map((calendar) => ({
        id: calendar.id,
        name: calendar.name,
        avatarUrl: calendar.avatar_url,
        accessMode: calendar.access_mode,
        role: calendar.calendar_members?.[0]?.role ?? null,
        eventLayout: calendar.event_layout,
        eventFieldSettings: normalizeCalendarEventFieldSettings(
            calendar.event_field_settings
        ),
        layoutOptions: normalizeCalendarLayoutOptions(calendar.layout_options),
        updatedAt: calendar.updated_at,
        createdAt: calendar.created_at,
    }))
}

export async function getLatestCalendarIdForUser(
    supabase: SupabaseClient,
    userId: string
): Promise<string | null> {
    const { data, error } = await supabase
        .from("calendars")
        .select("id, calendar_members!inner(user_id, status)")
        .eq("calendar_members.user_id", userId)
        .eq("calendar_members.status", "active")
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()

    if (error) {
        console.error("Failed to load latest calendar id:", error)
        return null
    }

    return data?.id ?? null
}

export async function getCalendarById(
    supabase: SupabaseClient,
    calendarId: string
): Promise<CalendarSummary | null> {
    const { data, error } = await supabase
        .from("calendars")
        .select(
            "id, name, avatar_url, access_mode, event_layout, event_field_settings, layout_options, updated_at, created_at"
        )
        .eq("id", calendarId)
        .maybeSingle()

    if (error) {
        console.error("Failed to load active calendar:", error)
        return null
    }

    if (!data) {
        return null
    }

    const calendar = data as Omit<CalendarRow, "calendar_members">

    return {
        id: calendar.id,
        name: calendar.name,
        avatarUrl: calendar.avatar_url,
        accessMode: calendar.access_mode,
        eventLayout: calendar.event_layout,
        eventFieldSettings: normalizeCalendarEventFieldSettings(
            calendar.event_field_settings
        ),
        layoutOptions: normalizeCalendarLayoutOptions(calendar.layout_options),
        updatedAt: calendar.updated_at,
        createdAt: calendar.created_at,
    }
}

export async function getCalendarInitialData(
    supabase: SupabaseClient,
    calendarId: string
): Promise<CalendarInitialData> {
    const [{ data, error }, subscriptionCatalogs, subscriptionFavorites] =
        await Promise.all([
        supabase.rpc("get_calendar_initial_data", {
            target_calendar_id: calendarId,
        }),
        getCalendarSubscriptionCatalog(supabase, calendarId),
        getCalendarSubscriptionFavorites(supabase, calendarId),
    ])

    if (error || !data) {
        console.error("Failed to load calendar initial data:", error)
        return {
            calendar: null,
            membership: {
                isMember: false,
                role: null,
                status: null,
            },
            myCalendars: [],
            eventCategories: [],
            events: [],
            subscriptionCatalogs: [],
            subscriptionState: {
                installedSubscriptionIds: [],
                hiddenSubscriptionIds: [],
            },
            subscriptionFavoriteEventIds: [],
        }
    }

    const payload = data as CalendarInitialDataPayload

    return {
        calendar: normalizeCalendarSummary(payload.calendar ?? null),
        membership: normalizeCalendarMembership(payload.membership),
        myCalendars: (payload.myCalendars ?? []).map(normalizeMyCalendarItem),
        eventCategories: (payload.eventCategories ?? []).map(
            normalizeCalendarEventCategorySummary
        ),
        events: (payload.events ?? []).map((event) =>
            normalizeCalendarEventForCalendar(
                mapCalendarEventRecordToCalendarEvent(event),
                calendarId
            )
        ),
        subscriptionCatalogs: subscriptionCatalogs.map((subscription) => ({
            id: subscription.id,
            slug: subscription.slug,
            name: subscription.name,
            description: subscription.description,
            authority: subscription.verified ? "system" : "user",
            ownerName:
                subscription.providerName ??
                (subscription.verified ? "캘린버" : "공유 사용자"),
            providerName: subscription.providerName,
            verified: subscription.verified,
            tags: [],
            categoryColor: subscription.categoryColor ?? undefined,
            sourceType: subscription.sourceType,
            sourceCalendarId: subscription.sourceCalendarId,
            sourceCalendarName: subscription.sourceCalendarName,
            status: subscription.status,
            sourceDeletedAt: subscription.sourceDeletedAt,
            sourceDeletedReason: subscription.sourceDeletedReason,
            config: subscription.config,
        })),
        subscriptionState: {
            installedSubscriptionIds: subscriptionCatalogs
                .filter((subscription) => subscription.installed)
                .map((subscription) => subscription.id),
            hiddenSubscriptionIds: subscriptionCatalogs
                .filter(
                    (subscription) =>
                        subscription.installed && !subscription.isVisible
                )
                .map((subscription) => subscription.id),
        },
        subscriptionFavoriteEventIds: subscriptionFavorites,
    }
}

export async function getCalendarSubscriptionFavorites(
    supabase: SupabaseClient,
    calendarId: string
) {
    const { data, error } = await supabase
        .from("subscription_event_favorites")
        .select("event_id, created_at")
        .eq("calendar_id", calendarId)

    if (error || !data) {
        console.error("Failed to load subscription favorites:", error)
        return [] as Array<{ eventId: string; favoritedAt: number }>
    }

    return (data as CalendarSubscriptionFavoriteRow[]).map((row) => ({
        eventId: row.event_id,
        favoritedAt: new Date(row.created_at).valueOf(),
    }))
}

export async function getCalendarSubscriptionCatalog(
    supabase: SupabaseClient,
    calendarId: string,
    searchQuery?: string
): Promise<CalendarSubscriptionCatalog[]> {
    const { data, error } = await supabase.rpc("get_calendar_subscription_catalog", {
        target_calendar_id: calendarId,
        search_query: searchQuery ?? null,
    })

    if (error || !data) {
        console.error("Failed to load calendar subscription catalog:", error)
        return []
    }

    return (data as CalendarSubscriptionCatalogRow[]).map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        sourceType: normalizeCalendarSubscriptionSourceType(row.source_type),
        providerName: row.provider_name,
        sourceCalendarId: row.source_calendar_id,
        sourceCalendarName: row.source_calendar_name,
        verified: row.verified,
        status: row.status,
        sourceDeletedAt: row.source_deleted_at,
        sourceDeletedReason: row.source_deleted_reason,
        categoryColor: normalizeCalendarCategoryColor(row.category_color),
        config: (row.config ?? {}) as Record<string, unknown>,
        installed: row.installed,
        isVisible: row.is_visible,
    }))
}

export async function getCalendarMembership(
    supabase: SupabaseClient,
    calendarId: string,
    userId: string | null
): Promise<CalendarMembership> {
    if (!userId) {
        return {
            isMember: false,
            role: null,
            status: null,
        }
    }

    const { data, error } = await supabase
        .from("calendar_members")
        .select("role, status")
        .eq("calendar_id", calendarId)
        .eq("user_id", userId)
        .maybeSingle()

    if (error) {
        console.error("Failed to load calendar membership:", error)
        return {
            isMember: false,
            role: null,
            status: null,
        }
    }

    return {
        isMember: data?.status === "active",
        role: data?.role ?? null,
        status: data?.status ?? null,
    }
}

export async function getCalendarEvents(
    supabase: SupabaseClient,
    calendarId: string
) {
    const { data, error } = await supabase.rpc(
        "get_calendar_events_with_authors",
        {
            target_calendar_id: calendarId,
        }
    )

    if (error || !data) {
        console.error("Failed to load calendar events:", error)
        return []
    }

    return (data as CalendarEventRecord[]).map((event) =>
        normalizeCalendarEventForCalendar(
            mapCalendarEventRecordToCalendarEvent(event),
            calendarId
        )
    )
}

function normalizeCalendarEventForCalendar(
    event: CalendarEvent,
    calendarId: string
) {
    if (event.categories.length === 0) {
        return event
    }

    const categories = event.categories.map((category) => ({
        ...category,
        calendarId,
    }))

    return {
        ...event,
        categories,
        category: categories[0] ?? null,
    }
}

export async function getCalendarEventCategories(
    supabase: SupabaseClient,
    calendarId: string
): Promise<CalendarEventCategorySummary[]> {
    const { data, error } = await supabase.rpc("get_calendar_event_categories", {
        target_calendar_id: calendarId,
    })

    if (error || !data) {
        console.error("Failed to load calendar event categories:", error)
        return []
    }

    return (data as CalendarEventCategoryRow[]).map(
        normalizeCalendarEventCategorySummary
    )
}

export async function getCalendarMemberDirectory(
    supabase: SupabaseClient,
    calendarId: string
): Promise<CalendarMemberDirectoryItem[]> {
    const cached = calendarMemberDirectoryCache.get(calendarId)
    const now = Date.now()

    if (
        cached &&
        cached.data.length > 0 &&
        now - cached.fetchedAt < CALENDAR_MEMBER_DIRECTORY_CACHE_TTL_MS
    ) {
        return cached.data
    }

    if (cached?.promise) {
        return cached.promise
    }

    const request = (async () => {
        const { data, error } = await supabase.rpc(
            "get_calendar_member_directory",
            {
                target_calendar_id: calendarId,
            }
        )

            if (error || !data) {
                console.error("Failed to load calendar members:", error)
                return []
            }

            const members = (data as CalendarMemberDirectoryRow[]).map((member) => ({
                id: member.id,
                userId: member.user_id,
                role: member.role,
                status: member.status,
                createdAt: member.created_at,
                email: member.email,
                name: member.name,
                avatarUrl: member.avatar_url,
            }))

            calendarMemberDirectoryCache.set(calendarId, {
                data: members,
                fetchedAt: Date.now(),
            })

            return members
        })().finally(() => {
            const nextCached = calendarMemberDirectoryCache.get(calendarId)

            if (nextCached?.promise) {
                calendarMemberDirectoryCache.set(calendarId, {
                    data: nextCached.data,
                    fetchedAt: nextCached.fetchedAt,
                })
            }
        })

    calendarMemberDirectoryCache.set(calendarId, {
        data: cached?.data ?? [],
        fetchedAt: cached?.fetchedAt ?? 0,
        promise: request,
    })

    return request
}

export async function getEventById(
    supabase: SupabaseClient,
    eventId: string,
    options?: {
        silentMissing?: boolean
    }
) {
    if (!isCalendarEventUuid(eventId)) {
        return null
    }

    const { data, error } = await supabase.rpc("get_calendar_event_by_id", {
        target_event_id: eventId,
    })

    if (error) {
        if (options?.silentMissing && error.code === "42501") {
            return null
        }

        console.error("Failed to load event:", error)
        return null
    }

    if (!data || data.length === 0) {
        if (!options?.silentMissing) {
            console.warn("Calendar event not found:", eventId)
        }

        return null
    }

    const event = normalizeCalendarEventForCalendar(
        mapCalendarEventRecordToCalendarEvent(data[0] as CalendarEventRecord),
        (data[0] as CalendarEventRecord).calendar_id
    )

    return event
}

export async function getEventMetadataByCalendarId(
    supabase: SupabaseClient,
    calendarId: string,
    eventId: string,
    options?: {
        silentMissing?: boolean
    }
): Promise<{
    calendar: CalendarSummary | null
    event: CalendarEventMetadata | null
}> {
    const { data, error } = await supabase
        .from("events")
        .select(
            "id, title, content, start_at, end_at, category_id, recurrence, exceptions, status, calendars!inner(id, name, avatar_url, access_mode, event_layout, event_field_settings, layout_options, updated_at, created_at), event_categories(id, calendar_id, name, options, created_by, created_at, updated_at)"
        )
        .eq("id", eventId)
        .eq("calendar_id", calendarId)
        .maybeSingle()

    if (error) {
        if (options?.silentMissing && error.code === "42501") {
            return {
                calendar: null,
                event: null,
            }
        }

        console.error("Failed to load event metadata:", error)
        return {
            calendar: null,
            event: null,
        }
    }

    if (!data) {
        if (!options?.silentMissing) {
            console.warn("Calendar event metadata not found:", eventId)
        }

        return {
            calendar: null,
            event: null,
        }
    }

    const row = data as unknown as CalendarEventWithCalendarRow
    const start = row.start_at
        ? new Date(row.start_at).valueOf()
        : Date.now()
    const end = row.end_at ? new Date(row.end_at).valueOf() : start
    const calendarRow = row.calendars

    return {
        calendar: calendarRow
            ? {
                  id: calendarRow.id,
                  name: calendarRow.name,
                  avatarUrl: calendarRow.avatar_url,
                  accessMode: calendarRow.access_mode,
                  eventLayout: calendarRow.event_layout,
                  eventFieldSettings: normalizeCalendarEventFieldSettings(
                      calendarRow.event_field_settings
                  ),
                  layoutOptions: normalizeCalendarLayoutOptions(
                      calendarRow.layout_options
                  ),
                  updatedAt: calendarRow.updated_at,
                  createdAt: calendarRow.created_at,
              }
            : null,
        event: {
            id: row.id,
            title: row.title,
            content: parseEventContent(row.content),
            start,
            end,
            status: row.status ?? "scheduled",
            author: null,
        },
    }
}

export async function getEventPageDataByCalendarId(
    supabase: SupabaseClient,
    calendarId: string,
    eventId: string,
    options?: {
        silentMissing?: boolean
    }
): Promise<{
    calendar: CalendarSummary | null
    event: CalendarEvent | null
}> {
    const [calendar, event] = await Promise.all([
        getCalendarById(supabase, calendarId),
        getEventById(supabase, eventId, options),
    ])

    if (!calendar || !event) {
        return {
            calendar: calendar ?? null,
            event: null,
        }
    }

    return {
        calendar,
        event,
    }
}
