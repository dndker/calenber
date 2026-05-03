import {
    mapCalendarEventRecordToCalendarEvent,
    type CalendarEventRecord,
} from "@/lib/calendar/event-record"
import { normalizeCalendarEventFieldSettings } from "@/lib/calendar/event-field-settings"
import { normalizeCalendarLayoutOptions } from "@/lib/calendar/layout-options"
import { normalizeCalendarCollectionColor } from "@/lib/calendar/collection-color"
import {
    isCalendarEventUuid,
    parseSubscriptionCompositeEventId,
} from "@/lib/calendar/event-id"
import {
    getValidAccessToken,
    getGoogleCalendarEvent,
} from "@/lib/google/calendar-api"
import {
    mapGoogleEventToCalendarEvent,
    parseGoogleCalendarEventId,
} from "@/lib/google/calendar-event-mapper"
import {
    calendarEventFromSharedCollectionRow,
    parseSharedCollectionRpcRow,
    type SharedCollectionRpcRow,
} from "@/lib/calendar/shared-collection-rpc-row"
import { parseEventContent } from "@/lib/calendar/event-content"
import type {
    CalendarSubscriptionCatalogItem,
    CalendarEvent,
    CalendarEventFieldSettings,
    EventSubscriptionItem,
    GoogleCalendarSubscriptionConfig,
} from "@/store/calendar-store.types"
import type {
    CalendarAccessMode,
    CalendarMemberStatus,
    CalendarRole,
} from "@/lib/calendar/permissions"
import type { CalendarEventLayout } from "@/lib/calendar/types"
import {
    KOREA_HOLIDAY_SUBSCRIPTION_ID,
    KOREAN_HOLIDAY_PROVIDER_KEY,
} from "@/lib/calendar/subscriptions/providers/korean-public-holidays"
import {
    KOREA_SOLAR_TERMS_SUBSCRIPTION_ID,
    KOREAN_SOLAR_TERMS_PROVIDER_KEY,
} from "@/lib/calendar/subscriptions/providers/korean-solar-terms"
import { getCalendarSubscriptions } from "@/lib/calendar/subscriptions/registry"
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

export type CalendarEventCollectionSummary = {
    id: string
    calendarId: string
    name: string
    options: {
        visibleByDefault: boolean
        color: CalendarEvent["collections"][number]["options"]["color"]
    }
    createdById: string | null
    createdAt: string
    updatedAt: string
}

export type CalendarInitialData = {
    calendar: CalendarSummary | null
    membership: CalendarMembership
    myCalendars: MyCalendarItem[]
    eventCollections: CalendarEventCollectionSummary[]
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
    sourceType:
        | "system_holiday"
        | "shared_collection"
        | "google_calendar"
        | "custom"
    verified: boolean
    status: "active" | "source_deleted" | "archived"
    sourceDeletedAt: string | null
    sourceDeletedReason: string | null
    providerName: string | null
    sourceCalendar: {
        id: string | null
        name: string | null
        avatarUrl: string | null
    } | null
    collectionColor: CalendarEvent["collections"][number]["options"]["color"] | null
    config: Record<string, unknown>
    installed: boolean
    isVisible: boolean
    /** 구독 카탈로그의 공개 범위. shared_collection 타입에만 존재. */
    visibility: "public" | "unlisted" | null
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
    collections: CalendarEvent["collections"] | null
    primary_collection_id: string | null
    recurrence: CalendarEvent["recurrence"] | null
    exceptions: CalendarEvent["exceptions"] | null
    participants: CalendarEvent["participants"] | null
    status: CalendarEvent["status"] | null
    created_by: string | null
    updated_by: string | null
    is_locked: boolean | null
    created_at: string
    updated_at: string | null
    event_collections: {
        id: string
        calendar_id: string
        name: string
        options: {
            visibleByDefault?: boolean
            color?: CalendarEvent["collections"][number]["options"]["color"]
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

type CalendarEventCollectionRow = {
    id: string
    calendar_id: string
    name: string
    options: {
        visibleByDefault?: boolean
        color?: CalendarEvent["collections"][number]["options"]["color"]
    } | null
    created_by: string | null
    created_at: string
    updated_at: string
}

type CalendarInitialDataPayload = {
    calendar: CalendarSummary | null
    membership: CalendarMembership | null
    myCalendars: MyCalendarItem[] | null
    eventCollections: CalendarEventCollectionSummary[] | null
    events: CalendarEventRecord[] | null
}

type CalendarSubscriptionCatalogRow = {
    id: string
    slug: string
    name: string
    description: string
    source_type:
        | "system_holiday"
        | "shared_collection"
        | "shared_calendar"
        | "custom"
    verified: boolean
    status: "active" | "source_deleted" | "archived"
    source_deleted_at: string | null
    source_deleted_reason: string | null
    provider_name: string | null
    source_calendar_id: string | null
    source_calendar_name: string | null
    collection_color: string | null
    config: Record<string, unknown> | null
    installed: boolean
    is_visible: boolean
    visibility: string | null
}

type SourceCalendarMetaRow = {
    id: string
    name: string
    avatar_url: string | null
}

type GoogleIntegrationMetaRow = {
    google_account_id: string
    google_email: string
}

function normalizeCalendarSubscriptionSourceType(
    sourceType: CalendarSubscriptionCatalogRow["source_type"]
): CalendarSubscriptionCatalog["sourceType"] {
    if (sourceType === "shared_calendar") {
        return "custom"
    }

    return sourceType
}

const BUILTIN_SUBSCRIPTION_PROVIDER_BY_SLUG: Record<string, string> = {
    [KOREA_HOLIDAY_SUBSCRIPTION_ID]: KOREAN_HOLIDAY_PROVIDER_KEY,
    [KOREA_SOLAR_TERMS_SUBSCRIPTION_ID]: KOREAN_SOLAR_TERMS_PROVIDER_KEY,
}

/**
 * DB 카탈로그에 없는 코드 기반 시스템 구독(공휴일·절기 등)을 붙입니다.
 * 일정은 DB가 아니라 각 provider에서 동적으로 생성합니다.
 */
function mergeBuiltinSystemSubscriptionCatalog(
    rpcCatalog: CalendarSubscriptionCatalog[]
): CalendarSubscriptionCatalog[] {
    const bySlug = new Map(rpcCatalog.map((row) => [row.slug, row]))
    const merged: CalendarSubscriptionCatalog[] = [...rpcCatalog]

    for (const builtin of getCalendarSubscriptions()) {
        const slug = builtin.slug ?? builtin.id

        if (bySlug.has(slug)) {
            continue
        }

        const builtinSource = builtin.sourceType ?? "system_holiday"

        merged.push({
            id: slug,
            slug,
            name: builtin.name,
            description: builtin.description,
            sourceType:
                builtinSource === "shared_collection"
                    ? "shared_collection"
                    : builtinSource === "custom"
                      ? "custom"
                      : "system_holiday",
            verified: builtin.verified,
            status: builtin.status ?? "active",
            sourceDeletedAt: builtin.sourceDeletedAt ?? null,
            sourceDeletedReason: builtin.sourceDeletedReason ?? null,
            providerName: builtin.ownerName ?? "Calenber",
            sourceCalendar: builtin.calendar
                ? {
                      id: builtin.calendar.id ?? null,
                      name: builtin.calendar.name ?? null,
                      avatarUrl: builtin.calendar.avatarUrl ?? null,
                  }
                : null,
            collectionColor: normalizeCalendarCollectionColor(
                builtin.collectionColor ?? null
            ),
            config: {
                locale: "ko-KR",
                timezone: "Asia/Seoul",
                provider: BUILTIN_SUBSCRIPTION_PROVIDER_BY_SLUG[slug] ?? "",
            },
            installed: false,
            isVisible: true,
            visibility: null,
        })
        bySlug.set(slug, merged[merged.length - 1]!)
    }

    return merged
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

function normalizeCalendarEventCollectionSummary(
    collection: CalendarEventCollectionSummary | CalendarEventCollectionRow
): CalendarEventCollectionSummary {
    const calendarId =
        "calendarId" in collection ? collection.calendarId : collection.calendar_id
    const createdById =
        "createdById" in collection ? collection.createdById : collection.created_by
    const createdAt =
        "createdAt" in collection ? collection.createdAt : collection.created_at
    const updatedAt =
        "updatedAt" in collection ? collection.updatedAt : collection.updated_at

    return {
        id: collection.id,
        calendarId,
        name: collection.name,
        options: {
            visibleByDefault: collection.options?.visibleByDefault !== false,
            color: normalizeCalendarCollectionColor(collection.options?.color),
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
    const [{ data, error }, subscriptionCatalogRpc, subscriptionFavorites] =
        await Promise.all([
        supabase.rpc("get_calendar_initial_data", {
            target_calendar_id: calendarId,
        }),
        getCalendarSubscriptionCatalog(supabase, calendarId),
        getCalendarSubscriptionFavorites(supabase, calendarId),
    ])

    const subscriptionCatalogs = mergeBuiltinSystemSubscriptionCatalog(
        subscriptionCatalogRpc
    )

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
            eventCollections: [],
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
        eventCollections: (payload.eventCollections ?? []).map(
            normalizeCalendarEventCollectionSummary
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
                (subscription.verified ? "Calenber" : "Shared user"),
            providerName: subscription.providerName,
            verified: subscription.verified,
            tags: [],
            collectionColor: subscription.collectionColor ?? undefined,
            sourceType: subscription.sourceType,
            calendar: subscription.sourceCalendar
                ? {
                      id: subscription.sourceCalendar.id,
                      name: subscription.sourceCalendar.name,
                      avatarUrl: subscription.sourceCalendar.avatarUrl,
                  }
                : null,
            status: subscription.status,
            sourceDeletedAt: subscription.sourceDeletedAt,
            sourceDeletedReason: subscription.sourceDeletedReason,
            config: subscription.config,
            visibility: subscription.visibility,
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
    const rows = data as CalendarSubscriptionCatalogRow[]
    const googleAccountIds = Array.from(
        new Set(
            rows
                .map((row) => {
                    const config = (row.config ?? {}) as Record<string, unknown>
                    return typeof config.googleAccountId === "string"
                        ? config.googleAccountId
                        : null
                })
                .filter((id): id is string => Boolean(id))
        )
    )
    const sourceCalendarIds = Array.from(
        new Set(
            rows
                .map((row) => row.source_calendar_id)
                .filter((id): id is string => Boolean(id))
        )
    )
    /** 원본 캘린더 ID → 이름·아바타 (구독자에게 RLS 로 calendars 행이 보이면 채워짐) */
    let sourceCalendarMetaById = new Map<
        string,
        { name: string; avatarUrl: string | null }
    >()
    let googleEmailByAccountId = new Map<string, string>()

    if (sourceCalendarIds.length > 0) {
        const { data: sourceCalendars, error: sourceCalendarError } = await supabase
            .from("calendars")
            .select("id, name, avatar_url")
            .in("id", sourceCalendarIds)

        if (sourceCalendarError) {
            console.error(
                "Failed to load source calendar meta for subscriptions:",
                sourceCalendarError
            )
        } else {
            sourceCalendarMetaById = new Map(
                ((sourceCalendars ?? []) as SourceCalendarMetaRow[]).map((row) => [
                    row.id,
                    {
                        name: row.name,
                        avatarUrl: row.avatar_url,
                    },
                ])
            )
        }
    }

    if (googleAccountIds.length > 0) {
        const { data: googleIntegrations, error: googleIntegrationError } =
            await supabase
                .from("user_google_integrations")
                .select("google_account_id, google_email")
                .in("google_account_id", googleAccountIds)

        if (googleIntegrationError) {
            console.error(
                "Failed to load Google integration emails for subscriptions:",
                googleIntegrationError
            )
        } else {
            googleEmailByAccountId = new Map(
                ((googleIntegrations ?? []) as GoogleIntegrationMetaRow[]).map(
                    (row) => [row.google_account_id, row.google_email]
                )
            )
        }
    }

    return rows.map((row) => {
        const meta = row.source_calendar_id
            ? sourceCalendarMetaById.get(row.source_calendar_id)
            : undefined
        const config = (row.config ?? {}) as Record<string, unknown>
        const googleAccountId =
            typeof config.googleAccountId === "string"
                ? config.googleAccountId
                : null
        const googleEmail = googleAccountId
            ? googleEmailByAccountId.get(googleAccountId) ?? null
            : null
        const normalizedConfig =
            googleEmail && config.provider === "google_calendar_v1"
                ? ({
                      ...(config as GoogleCalendarSubscriptionConfig),
                      googleEmail,
                  } as Record<string, unknown>)
                : config

        return {
            id: row.id,
            slug: row.slug,
            name: row.name,
            description: row.description,
            sourceType: normalizeCalendarSubscriptionSourceType(row.source_type),
            providerName: row.provider_name,
            sourceCalendar:
                row.source_calendar_id || row.source_calendar_name
                    ? {
                          id: row.source_calendar_id,
                          name: meta?.name ?? row.source_calendar_name ?? null,
                          avatarUrl: meta?.avatarUrl ?? null,
                      }
                    : null,
            verified: row.verified,
            status: row.status,
            sourceDeletedAt: row.source_deleted_at,
            sourceDeletedReason: row.source_deleted_reason,
            collectionColor: normalizeCalendarCollectionColor(row.collection_color),
            config: normalizedConfig,
            installed: row.installed,
            isVisible: row.is_visible,
            visibility:
                row.visibility === "public" || row.visibility === "unlisted"
                    ? row.visibility
                    : null,
        }
    })
}

/**
 * 구독 카탈로그 raw 데이터를 스토어용 CalendarSubscriptionCatalogItem 배열로 변환.
 * getCalendarInitialData와 동일한 매핑 로직을 공유한다.
 */
export function normalizeSubscriptionCatalogs(
    catalogs: CalendarSubscriptionCatalog[]
): CalendarSubscriptionCatalogItem[] {
    return catalogs.map((subscription) => ({
        id: subscription.id,
        slug: subscription.slug,
        name: subscription.name,
        description: subscription.description,
        authority: subscription.verified ? "system" : "user",
        ownerName:
            subscription.providerName ??
            (subscription.verified ? "Calenber" : "Shared user"),
        providerName: subscription.providerName,
        verified: subscription.verified,
        tags: [],
        collectionColor: subscription.collectionColor ?? undefined,
        sourceType: subscription.sourceType,
        calendar: subscription.sourceCalendar
            ? {
                  id: subscription.sourceCalendar.id,
                  name: subscription.sourceCalendar.name,
                  avatarUrl: subscription.sourceCalendar.avatarUrl,
              }
            : null,
        status: subscription.status,
        sourceDeletedAt: subscription.sourceDeletedAt,
        sourceDeletedReason: subscription.sourceDeletedReason,
        config: subscription.config,
        visibility: subscription.visibility,
    }))
}

/**
 * 구독 카탈로그를 DB에서 다시 읽어 스토어용 형태로 반환.
 * 구독 추가/삭제 후 스토어를 갱신할 때 사용한다.
 */
export async function fetchAndNormalizeSubscriptionCatalogs(
    supabase: SupabaseClient,
    calendarId: string
): Promise<{
    catalogs: CalendarSubscriptionCatalogItem[]
    installedIds: string[]
    hiddenIds: string[]
}> {
    const raw = await getCalendarSubscriptionCatalog(supabase, calendarId)
    const merged = mergeBuiltinSystemSubscriptionCatalog(raw)
    const catalogs = normalizeSubscriptionCatalogs(merged)
    return {
        catalogs,
        installedIds: merged
            .filter((s) => s.installed)
            .map((s) => s.id),
        hiddenIds: merged
            .filter((s) => s.installed && !s.isVisible)
            .map((s) => s.id),
    }
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
    if (event.collections.length === 0) {
        return event
    }

    const collections = event.collections.map((collection) => ({
        ...collection,
        calendarId,
    }))

    return {
        ...event,
        collections,
        primaryCollection: collections[0] ?? null,
    }
}

export async function getCalendarEventCollections(
    supabase: SupabaseClient,
    calendarId: string
): Promise<CalendarEventCollectionSummary[]> {
    const { data, error } = await supabase.rpc("get_calendar_event_collections", {
        target_calendar_id: calendarId,
    })

    if (error || !data) {
        console.error("Failed to load calendar event collections:", error)
        return []
    }

    return (data as CalendarEventCollectionRow[]).map(
        normalizeCalendarEventCollectionSummary
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

function mapSharedCollectionRowToEventMetadata(
    row: SharedCollectionRpcRow,
    compositeEventId: string
): CalendarEventMetadata {
    const start = row.start_at ? new Date(row.start_at).valueOf() : Date.now()
    const end = row.end_at ? new Date(row.end_at).valueOf() : start

    return {
        id: compositeEventId,
        title: row.title,
        content: parseEventContent(
            row.content as CalendarEvent["content"] | string | null
        ),
        start,
        end,
        status: row.event_status as CalendarEvent["status"],
        author: null,
    }
}

function calendarCatalogRowToEventSubscriptionItem(
    row: CalendarSubscriptionCatalog
): EventSubscriptionItem {
    const googleEmail =
        typeof row.config.googleEmail === "string" ? row.config.googleEmail : null

    return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        sourceType: row.sourceType,
        authority: row.verified ? "system" : "user",
        providerName: row.providerName,
        calendar: row.sourceCalendar
            ? {
                  id: row.sourceCalendar.id ?? row.id,
                  name: row.sourceCalendar.name,
                  avatarUrl: row.sourceCalendar.avatarUrl,
              }
            : null,
        googleEmail,
    }
}

function subscriptionMetaFromViewerCatalogLookup(
    catalogs: CalendarSubscriptionCatalog[],
    catalogId: string
): EventSubscriptionItem {
    const catalog = catalogs.find((c) => c.id === catalogId)

    if (!catalog) {
        return {
            id: catalogId,
            name: "",
            sourceType: "shared_collection",
            authority: "user",
            providerName: null,
            calendar: null,
        }
    }

    return calendarCatalogRowToEventSubscriptionItem(catalog)
}

async function fetchSharedCollectionEventRowForViewer(
    supabase: SupabaseClient,
    viewerCalendarId: string,
    catalogId: string,
    sourceEventId: string
): Promise<SharedCollectionRpcRow | null> {
    const rangeStart = new Date("2000-01-01T00:00:00.000Z").toISOString()
    const rangeEnd = new Date("2100-01-01T00:00:00.000Z").toISOString()

    const { data, error } = await supabase.rpc(
        "get_shared_collection_subscription_events",
        {
            p_catalog_id: catalogId,
            p_calendar_id: viewerCalendarId,
            p_range_start: rangeStart,
            p_range_end: rangeEnd,
        }
    )

    if (error) {
        console.error("Failed to load shared collection event row:", error)
        return null
    }

    if (!Array.isArray(data)) {
        return null
    }

    for (const raw of data) {
        const row = parseSharedCollectionRpcRow(raw)
        if (row.event_id === sourceEventId) {
            return row
        }
    }

    return null
}

async function fetchGoogleCalendarEventForViewer(
    supabase: SupabaseClient,
    viewerCalendarId: string,
    viewerUserId: string,
    eventId: string
): Promise<CalendarEvent | null> {
    const parsedGoogleEvent = parseGoogleCalendarEventId(eventId)

    if (!parsedGoogleEvent) {
        return null
    }

    const catalogs = await getCalendarSubscriptionCatalog(supabase, viewerCalendarId)
    const catalog = catalogs.find(
        (item) =>
            item.id === parsedGoogleEvent.catalogId &&
            item.sourceType === "google_calendar" &&
            item.installed &&
            item.status === "active"
    )

    if (!catalog) {
        return null
    }

    const config = catalog.config as Partial<GoogleCalendarSubscriptionConfig>
    const googleCalendarId =
        typeof config.googleCalendarId === "string" ? config.googleCalendarId : null
    const googleAccountId =
        typeof config.googleAccountId === "string" ? config.googleAccountId : null

    if (!googleCalendarId || !googleAccountId) {
        return null
    }

    const accessToken = await getValidAccessToken(
        supabase,
        viewerUserId,
        googleAccountId
    )

    if (!accessToken) {
        return null
    }

    const googleEvent = await getGoogleCalendarEvent(
        accessToken,
        googleCalendarId,
        parsedGoogleEvent.googleEventId
    )

    if (!googleEvent) {
        return null
    }

    return mapGoogleEventToCalendarEvent(googleEvent, {
        catalogId: catalog.id,
        catalogName: catalog.name,
        collectionColor: catalog.collectionColor,
        defaultTimezone:
            typeof config.googleCalendarTimeZone === "string"
                ? config.googleCalendarTimeZone
                : null,
        isLocked: false,
        subscriptionMeta: {
            id: catalog.id,
            slug: catalog.slug,
            name: catalog.name,
            sourceType: catalog.sourceType,
            authority: "user",
            providerName: catalog.providerName ?? "Google Calendar",
            calendar: catalog.sourceCalendar?.id
                ? {
                      id: catalog.sourceCalendar.id,
                      name: catalog.sourceCalendar.name ?? catalog.name,
                      avatarUrl: catalog.sourceCalendar.avatarUrl,
                  }
                : null,
            googleEmail:
                typeof config.googleEmail === "string" ? config.googleEmail : null,
        },
    })
}

export async function getEventById(
    supabase: SupabaseClient,
    eventId: string,
    options?: {
        silentMissing?: boolean
        /** 구독 복합 ID(`sub:…`) 조회 시 설치된 캘린더(보는 사용자 워크스페이스) */
        viewerCalendarId?: string
        /** gcal: 이벤트를 서버에서 직접 조회할 때 사용하는 현재 사용자 ID */
        viewerUserId?: string
    }
) {
    const parsedSub = parseSubscriptionCompositeEventId(eventId)

    if (parsedSub) {
        const viewerCal = options?.viewerCalendarId

        if (!viewerCal) {
            return null
        }

        const [row, catalogs] = await Promise.all([
            fetchSharedCollectionEventRowForViewer(
                supabase,
                viewerCal,
                parsedSub.catalogId,
                parsedSub.sourceEventId
            ),
            getCalendarSubscriptionCatalog(supabase, viewerCal),
        ])

        if (!row) {
            if (!options?.silentMissing) {
                console.warn("Calendar event not found:", eventId)
            }

            return null
        }

        const subscriptionMeta = subscriptionMetaFromViewerCatalogLookup(
            catalogs,
            parsedSub.catalogId
        )

        return calendarEventFromSharedCollectionRow(
            row,
            eventId,
            subscriptionMeta
        )
    }

    if (parseGoogleCalendarEventId(eventId)) {
        const viewerCal = options?.viewerCalendarId
        const viewerUserId = options?.viewerUserId

        if (!viewerCal || !viewerUserId) {
            return null
        }

        return fetchGoogleCalendarEventForViewer(
            supabase,
            viewerCal,
            viewerUserId,
            eventId
        )
    }

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
        viewerUserId?: string
    }
): Promise<{
    calendar: CalendarSummary | null
    event: CalendarEventMetadata | null
}> {
    const parsedSub = parseSubscriptionCompositeEventId(eventId)

    if (parsedSub) {
        const [calendar, row] = await Promise.all([
            getCalendarById(supabase, calendarId),
            fetchSharedCollectionEventRowForViewer(
                supabase,
                calendarId,
                parsedSub.catalogId,
                parsedSub.sourceEventId
            ),
        ])

        if (!calendar || !row) {
            if (!options?.silentMissing && !row) {
                console.warn("Calendar event metadata not found:", eventId)
            }

            return {
                calendar: calendar ?? null,
                event: null,
            }
        }

        return {
            calendar,
            event: mapSharedCollectionRowToEventMetadata(row, eventId),
        }
    }

    if (parseGoogleCalendarEventId(eventId)) {
        const calendar = await getCalendarById(supabase, calendarId)
        const viewerUserId = options?.viewerUserId

        if (!calendar || !viewerUserId) {
            return {
                calendar: calendar ?? null,
                event: null,
            }
        }

        const event = await fetchGoogleCalendarEventForViewer(
            supabase,
            calendarId,
            viewerUserId,
            eventId
        )

        if (!event) {
            if (!options?.silentMissing) {
                console.warn("Calendar event metadata not found:", eventId)
            }

            return {
                calendar,
                event: null,
            }
        }

        return {
            calendar,
            event: {
                id: event.id,
                title: event.title,
                content: event.content,
                start: event.start,
                end: event.end,
                status: event.status,
                author: event.author
                    ? {
                          name: event.author.name,
                      }
                    : null,
            },
        }
    }

    const { data, error } = await supabase
        .from("events")
        .select(
            "id, title, content, start_at, end_at, primary_collection_id, recurrence, exceptions, status, calendars!inner(id, name, avatar_url, access_mode, event_layout, event_field_settings, layout_options, updated_at, created_at), event_collections(id, calendar_id, name, options, created_by, created_at, updated_at)"
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
        viewerUserId?: string
    }
): Promise<{
    calendar: CalendarSummary | null
    event: CalendarEvent | null
}> {
    const [calendar, event] = await Promise.all([
        getCalendarById(supabase, calendarId),
        getEventById(supabase, eventId, {
            ...options,
            viewerCalendarId: calendarId,
        }),
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
