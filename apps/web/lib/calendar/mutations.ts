import type { SupabaseClient } from "@supabase/supabase-js"
import { serializeEventContent } from "@/lib/calendar/event-content"
import { randomCalendarCollectionColor } from "@/lib/calendar/collection-color"
import { getDefaultCalendarEventFieldSettings } from "@/lib/calendar/event-field-settings"
import {
    mapCalendarEventRecordToCalendarEvent,
    type CalendarEventRecord,
} from "@/lib/calendar/event-record"
import type { CalendarAccessMode } from "@/lib/calendar/permissions"
import type { CalendarMembership } from "@/lib/calendar/queries"
import type {
    CalendarEvent,
    CalendarEventPatch,
    CalendarEventCollection,
} from "@/store/calendar-store.types"
import { normalizeCalendarCollectionColor } from "@/lib/calendar/collection-color"
import { resolveSubscriptionCatalogIdForInstall } from "@/lib/calendar/resolve-subscription-catalog-id"
import { KOREA_HOLIDAY_SUBSCRIPTION_ID } from "@/lib/calendar/subscriptions/providers/korean-public-holidays"

type CalendarEventCollectionRow = {
    id: string
    calendar_id: string
    name: string
    options: {
        visibleByDefault?: boolean
        color?: CalendarEventCollection["options"]["color"]
    } | null
    created_by: string | null
    created_at: string
    updated_at: string
}

function normalizeEventCollectionOptions(
    options?: Partial<CalendarEventCollection["options"]> | null
) {
    return {
        visibleByDefault: options?.visibleByDefault !== false,
        color:
            normalizeCalendarCollectionColor(options?.color) ??
            randomCalendarCollectionColor(),
    }
}

function mapCalendarEventCollectionRow(
    collection: CalendarEventCollectionRow
): CalendarEventCollection {
    return {
        id: collection.id,
        calendarId: collection.calendar_id,
        name: collection.name,
        options: normalizeEventCollectionOptions(collection.options),
        createdById: collection.created_by,
        createdAt: new Date(collection.created_at).valueOf(),
        updatedAt: new Date(collection.updated_at).valueOf(),
    }
}

async function ensureCalendarEventCollection(
    supabase: SupabaseClient,
    calendarId: string,
    input: CalendarEvent["primaryCollection"]
) {
    const trimmedName = input?.name?.trim()

    if (!trimmedName) {
        return null
    }

    if (input?.id) {
        return input.id
    }

    const { data, error } = await supabase.rpc(
        "upsert_calendar_event_collection",
        {
            target_calendar_id: calendarId,
            target_name: trimmedName,
            target_options:
                input?.options != null
                    ? normalizeEventCollectionOptions(input.options)
                    : null,
        }
    )

    if (error || !data) {
        console.error("Failed to ensure calendar event collection:", error)
        return null
    }

    return typeof data === "string" ? data : null
}

async function ensureCalendarEventCollections(
    supabase: SupabaseClient,
    calendarId: string,
    inputs: CalendarEvent["collections"]
) {
    const entries = await Promise.all(
        inputs.map(async (collection) => {
            const reuseExistingId =
                Boolean(collection.id) &&
                Boolean(collection.calendarId) &&
                collection.calendarId === calendarId

            const collectionId = reuseExistingId
                ? collection.id
                : await ensureCalendarEventCollection(supabase, calendarId, {
                      ...collection,
                      id: "",
                  })

            return collectionId
                ? {
                      ...collection,
                      id: collectionId,
                      calendarId,
                  }
                : null
        })
    )

    return entries.filter(
        (collection): collection is NonNullable<(typeof entries)[number]> =>
            Boolean(collection)
    )
}

async function replaceCalendarEventCollections(
    supabase: SupabaseClient,
    eventId: string,
    collectionIds: string[]
) {
    const uniqueCollectionIds = Array.from(
        new Set(collectionIds.filter(Boolean))
    )

    const { error } = await supabase.rpc("replace_calendar_event_collections", {
        target_event_id: eventId,
        target_collection_ids: uniqueCollectionIds,
    })

    if (error) {
        console.error("Failed to replace calendar event collections:", error)
        return false
    }

    return true
}

async function replaceCalendarEventParticipants(
    supabase: SupabaseClient,
    eventId: string,
    participantUserIds: string[]
) {
    const uniqueUserIds = Array.from(
        new Set(participantUserIds.filter(Boolean))
    )

    const { error } = await supabase.rpc("replace_calendar_event_participants", {
        target_event_id: eventId,
        target_user_ids: uniqueUserIds,
    })

    if (error) {
        console.error("Failed to replace calendar event participants:", error)
        return false
    }

    return true
}

export async function createCalendarEventCollection(
    supabase: SupabaseClient,
    calendarId: string,
    input: {
        name: string
        options?: Partial<CalendarEventCollection["options"]>
    }
) {
    const trimmedName = input.name.trim()

    if (!trimmedName) {
        return null
    }

    const normalizedOptions = normalizeEventCollectionOptions(input.options)
    const { data: collectionId, error: upsertError } = await supabase.rpc(
        "upsert_calendar_event_collection",
        {
            target_calendar_id: calendarId,
            target_name: trimmedName,
            target_options: normalizedOptions,
        }
    )

    if (upsertError || !collectionId) {
        console.error(
            "Failed to create calendar event collection:",
            upsertError
        )
        return null
    }

    const { data, error } = await supabase
        .from("event_collections")
        .select(
            "id, calendar_id, name, options, created_by, created_at, updated_at"
        )
        .eq("id", collectionId)
        .single()

    if (error || !data) {
        console.error(
            "Failed to fetch created calendar event collection:",
            error
        )
        return null
    }

    return mapCalendarEventCollectionRow(data as CalendarEventCollectionRow)
}

export async function updateCalendarEventCollection(
    supabase: SupabaseClient,
    collectionId: string,
    patch: {
        name?: string
        options?: Partial<CalendarEventCollection["options"]>
    }
) {
    const updates: Record<string, unknown> = {}

    if (patch.name !== undefined) {
        const trimmedName = patch.name.trim()

        if (!trimmedName) {
            return null
        }

        updates.name = trimmedName
    }

    if (patch.options !== undefined) {
        updates.options = normalizeEventCollectionOptions(patch.options)
    }

    if (Object.keys(updates).length === 0) {
        return null
    }

    const { data, error } = await supabase
        .from("event_collections")
        .update(updates)
        .eq("id", collectionId)
        .select(
            "id, calendar_id, name, options, created_by, created_at, updated_at"
        )
        .single()

    if (error || !data) {
        console.error("Failed to update calendar event collection:", error)
        return null
    }

    return mapCalendarEventCollectionRow(data as CalendarEventCollectionRow)
}

export async function deleteCalendarEventCollection(
    supabase: SupabaseClient,
    collectionId: string
) {
    const { data, error } = await supabase.rpc(
        "delete_calendar_event_collection",
        {
            target_collection_id: collectionId,
        }
    )

    if (error) {
        console.error("Failed to delete calendar event collection:", error)
        return false
    }

    return Boolean(data)
}

export async function createCalendarEvent(
    supabase: SupabaseClient,
    calendarId: string,
    event: CalendarEvent
) {
    const {
        data: { user },
    } = await supabase.auth.getUser()
    const ensuredCollections = await ensureCalendarEventCollections(
        supabase,
        calendarId,
        event.collections
    )
    const primaryCollectionId =
        ensuredCollections[0]?.id ??
        event.primaryCollectionId ??
        event.primaryCollection?.id ??
        null
    const collectionIdsToSync =
        ensuredCollections.length > 0
            ? ensuredCollections.map((collection) => collection.id)
            : primaryCollectionId
              ? [primaryCollectionId]
              : []

    const { data, error } = await supabase
        .from("events")
        .insert({
            id: event.id,
            calendar_id: calendarId,
            created_by: user?.id ?? event.authorId,
            primary_collection_id: primaryCollectionId,
            recurrence: event.recurrence ?? null,
            exceptions: event.exceptions ?? [],
            status: event.status,
            is_locked: event.isLocked,
            title: event.title,
            content: serializeEventContent(event.content),
            start_at: new Date(event.start).toISOString(),
            end_at: new Date(event.end).toISOString(),
            all_day: event.allDay ?? false,
            timezone: event.timezone || "Asia/Seoul",
        })
        .select("id")
        .single()

    if (error || !data) {
        console.error("Failed to create calendar event:", error)
        return null
    }

    if (collectionIdsToSync.length > 0) {
        const syncedCollections = await replaceCalendarEventCollections(
            supabase,
            event.id,
            collectionIdsToSync
        )

        if (!syncedCollections) {
            return null
        }
    }

    if (event.participants.length > 0) {
        const syncedParticipants = await replaceCalendarEventParticipants(
            supabase,
            event.id,
            event.participants.map((participant) => participant.userId)
        )

        if (!syncedParticipants) {
            return null
        }
    }

    return data
}

export async function createCalendar(
    supabase: SupabaseClient,
    input: {
        name: string
        accessMode: CalendarAccessMode
    }
) {
    const {
        data: { session },
    } = await supabase.auth.getSession()

    const user = session?.user

    if (!user) {
        return null
    }

    const calendarId = crypto.randomUUID()

    const { error } = await supabase
        .from("calendars")
        .insert({
            id: calendarId,
            name: input.name,
            access_mode: input.accessMode,
            created_by: user.id,
            event_field_settings: getDefaultCalendarEventFieldSettings(),
        })

    if (error) {
        console.error("Failed to create calendar:", error)
        return null
    }

    const { error: membershipError } = await supabase
        .from("calendar_members")
        .insert({
            calendar_id: calendarId,
            user_id: user.id,
            role: "owner",
            status: "active",
        })

    if (membershipError) {
        console.error(
            "Failed to create calendar owner membership:",
            membershipError
        )
        return null
    }

    // Holiday subscription install is best-effort — calendar creation succeeds regardless.
    const holidayCatalogId = await resolveSubscriptionCatalogIdForInstall(
        supabase,
        KOREA_HOLIDAY_SUBSCRIPTION_ID
    )

    if (!holidayCatalogId) {
        console.warn(
            "Missing Korea holiday subscription catalog row; run migrations."
        )
    } else {
        const { error: installSubscriptionError } = await supabase
            .from("calendar_subscription_installs")
            .upsert(
                {
                    calendar_id: calendarId,
                    subscription_catalog_id: holidayCatalogId,
                    is_visible: true,
                    created_by: user.id,
                },
                { onConflict: "calendar_id,subscription_catalog_id" }
            )

        if (installSubscriptionError) {
            console.warn(
                "Failed to auto install Korea holiday subscription:",
                installSubscriptionError
            )
        }
    }

    return { id: calendarId }
}

export async function updateCalendarEvent(
    supabase: SupabaseClient,
    eventId: string,
    patch: CalendarEventPatch,
    options?: {
        expectedUpdatedAt?: number
    }
) {
    const updates: Record<string, unknown> = {}
    const changedFields: string[] = []
    let resolvedPrimaryCollectionId = patch.primaryCollectionId
    let resolvedCollections = patch.collections

    if (patch.title !== undefined) {
        updates.title = patch.title
        changedFields.push("title")
    }

    if (patch.content !== undefined) {
        updates.content = serializeEventContent(patch.content)
        changedFields.push("content")
    }

    if (patch.start !== undefined) {
        updates.start_at = new Date(patch.start).toISOString()
        changedFields.push("start_at")
    }

    if (patch.end !== undefined) {
        updates.end_at = new Date(patch.end).toISOString()
        changedFields.push("end_at")
    }

    if (patch.allDay !== undefined) {
        updates.all_day = patch.allDay
        changedFields.push("all_day")
    }

    if (patch.timezone !== undefined) {
        updates.timezone = patch.timezone || "Asia/Seoul"
        changedFields.push("timezone")
    }

    if (patch.collections !== undefined || patch.collectionIds !== undefined) {
        if (
            patch.collections?.length === 0 ||
            patch.collectionIds?.length === 0 ||
            patch.primaryCollectionId === null ||
            patch.primaryCollection === null
        ) {
            resolvedPrimaryCollectionId = null
            resolvedCollections = []
        } else if (
            patch.collections &&
            patch.collections.length > 0 &&
            patch.collectionIds === undefined
        ) {
            const { data: eventRow, error: eventError } = await supabase
                .from("events")
                .select("calendar_id")
                .eq("id", eventId)
                .single()

            if (eventError || !eventRow?.calendar_id) {
                console.error(
                    "Failed to resolve event calendar for collection:",
                    eventError
                )
                return {
                    ok: false as const,
                    status: "error" as const,
                    event: null,
                    conflictingFields: [],
                }
            }

            resolvedCollections = await ensureCalendarEventCollections(
                supabase,
                eventRow.calendar_id as string,
                patch.collections
            )

            if (
                patch.collections.some((collection) => collection.name.trim()) &&
                resolvedCollections.length === 0
            ) {
                return {
                    ok: false as const,
                    status: "error" as const,
                    event: null,
                    conflictingFields: [],
                }
            }

            resolvedPrimaryCollectionId = resolvedCollections[0]?.id ?? null
        } else if (patch.collectionIds && patch.collectionIds.length > 0) {
            resolvedPrimaryCollectionId = patch.collectionIds[0] ?? null
        }

        updates.primary_collection_id = resolvedPrimaryCollectionId
        changedFields.push("collections")
    }

    if (patch.recurrence !== undefined) {
        updates.recurrence = patch.recurrence ?? null
        changedFields.push("recurrence")
    }

    if (patch.exceptions !== undefined) {
        updates.exceptions = patch.exceptions ?? []
        changedFields.push("exceptions")
    }

    if (patch.participants !== undefined) {
        changedFields.push("participants")
    }

    if (patch.status !== undefined) {
        updates.status = patch.status
        changedFields.push("status")
    }

    if (patch.isLocked !== undefined) {
        updates.is_locked = patch.isLocked
        changedFields.push("is_locked")
    }

    if (Object.keys(updates).length === 0 && patch.participants === undefined) {
        return {
            ok: true as const,
            status: "noop" as const,
            event: null,
            conflictingFields: [],
        }
    }

    const expectedUpdatedAt =
        options?.expectedUpdatedAt != null
            ? new Date(options.expectedUpdatedAt).toISOString()
            : null

    if (!expectedUpdatedAt) {
        if (Object.keys(updates).length > 0) {
            const { error } = await supabase
                .from("events")
                .update(updates)
                .eq("id", eventId)

            if (error) {
                console.error("Failed to update calendar event:", error)
                return {
                    ok: false as const,
                    status: "error" as const,
                    event: null,
                    conflictingFields: [],
                }
            }
        }

        if (patch.participants !== undefined) {
            const syncedParticipants = await replaceCalendarEventParticipants(
                supabase,
                eventId,
                patch.participants.map((participant) => participant.userId)
            )

            if (!syncedParticipants) {
                return {
                    ok: false as const,
                    status: "error" as const,
                    event: null,
                    conflictingFields: [],
                }
            }
        }

        if (patch.collections !== undefined || patch.collectionIds !== undefined) {
            const syncedCollections = await replaceCalendarEventCollections(
                supabase,
                eventId,
                resolvedCollections?.map((collection) => collection.id) ??
                    patch.collectionIds ??
                    []
            )

            if (!syncedCollections) {
                return {
                    ok: false as const,
                    status: "error" as const,
                    event: null,
                    conflictingFields: [],
                }
            }
        }

        return {
            ok: true as const,
            status: "updated" as const,
            event: null,
            conflictingFields: [],
        }
    }

    const { data, error } = await supabase.rpc(
        "update_calendar_event_with_conflict_resolution",
        {
            target_event_id: eventId,
            expected_updated_at: expectedUpdatedAt,
            patch: updates,
            changed_fields: changedFields,
        }
    )

    if (error) {
        console.error("Failed to update calendar event:", error)
        return {
            ok: false as const,
            status: "error" as const,
            event: null,
            conflictingFields: [],
        }
    }

    const row = Array.isArray(data) ? data[0] : null

    if (patch.participants !== undefined && row?.status !== "conflict") {
        const syncedParticipants = await replaceCalendarEventParticipants(
            supabase,
            eventId,
            patch.participants.map((participant) => participant.userId)
        )

        if (!syncedParticipants) {
            return {
                ok: false as const,
                status: "error" as const,
                event: null,
                conflictingFields: [],
            }
        }
    }

    if (
        row?.status !== "conflict" &&
        (patch.collections !== undefined || patch.collectionIds !== undefined)
    ) {
        const syncedCollections = await replaceCalendarEventCollections(
            supabase,
            eventId,
            resolvedCollections?.map((collection) => collection.id) ??
                patch.collectionIds ??
                []
        )

        if (!syncedCollections) {
            return {
                ok: false as const,
                status: "error" as const,
                event: null,
                conflictingFields: [],
            }
        }
    }
    const record = row?.record as CalendarEventRecord | null | undefined

    return {
        ok: row?.status === "updated" || row?.status === "merged",
        status: (row?.status ??
            "error") as "updated" | "merged" | "conflict" | "not_found" | "error",
        event: record ? mapCalendarEventRecordToCalendarEvent(record) : null,
        conflictingFields: Array.isArray(row?.conflicting_fields)
            ? (row.conflicting_fields as string[])
            : [],
    }
}

export async function deleteCalendarEvent(
    supabase: SupabaseClient,
    eventId: string
) {
    const { error } = await supabase.from("events").delete().eq("id", eventId)

    if (error) {
        console.error("Failed to delete calendar event:", error)
        return false
    }

    return true
}

export async function setCalendarEventFavorite(
    supabase: SupabaseClient,
    input: {
        eventId: string
        userId: string
        isFavorite: boolean
    }
) {
    if (input.isFavorite) {
        const { data, error } = await supabase
            .from("event_favorites")
            .upsert(
                {
                    event_id: input.eventId,
                    user_id: input.userId,
                },
                {
                    onConflict: "event_id,user_id",
                }
            )
            .select("created_at")
            .single()

        if (error) {
            console.error("Failed to favorite calendar event:", error)
            return {
                ok: false as const,
                favoritedAt: null,
            }
        }

        return {
            ok: true as const,
            favoritedAt: data?.created_at
                ? new Date(data.created_at).valueOf()
                : Date.now(),
        }
    }

    const { error } = await supabase
        .from("event_favorites")
        .delete()
        .eq("event_id", input.eventId)
        .eq("user_id", input.userId)

    if (error) {
        console.error("Failed to unfavorite calendar event:", error)
        return {
            ok: false as const,
            favoritedAt: null,
        }
    }

    return {
        ok: true as const,
        favoritedAt: null,
    }
}

export async function setCalendarSubscriptionEventFavorite(
    supabase: SupabaseClient,
    input: {
        calendarId: string
        eventId: string
        userId: string
        isFavorite: boolean
    }
) {
    if (input.isFavorite) {
        const { data, error } = await supabase
            .from("subscription_event_favorites")
            .upsert(
                {
                    calendar_id: input.calendarId,
                    event_id: input.eventId,
                    user_id: input.userId,
                },
                {
                    onConflict: "calendar_id,event_id,user_id",
                }
            )
            .select("created_at")
            .single()

        if (error) {
            console.error("Failed to favorite subscription event:", error)
            return {
                ok: false as const,
                favoritedAt: null,
            }
        }

        return {
            ok: true as const,
            favoritedAt: data?.created_at
                ? new Date(data.created_at).valueOf()
                : Date.now(),
        }
    }

    const { error } = await supabase
        .from("subscription_event_favorites")
        .delete()
        .eq("calendar_id", input.calendarId)
        .eq("event_id", input.eventId)
        .eq("user_id", input.userId)

    if (error) {
        console.error("Failed to unfavorite subscription event:", error)
        return {
            ok: false as const,
            favoritedAt: null,
        }
    }

    return {
        ok: true as const,
        favoritedAt: null,
    }
}

export async function leaveCalendar(
    supabase: SupabaseClient,
    calendarId: string
) {
    const { error } = await supabase.rpc("leave_calendar", {
        target_calendar_id: calendarId,
    })

    if (error) {
        console.error("Failed to leave calendar:", error)
        return false
    }

    return true
}

export async function deleteOwnedCalendar(
    supabase: SupabaseClient,
    calendarId: string
) {
    const { error } = await supabase.rpc("delete_owned_calendar", {
        target_calendar_id: calendarId,
    })

    if (error) {
        console.error("Failed to delete calendar:", error)
        return error.message
    }

    return true as const
}

export async function deleteCurrentUserAccount(supabase: SupabaseClient) {
    const { error } = await supabase.rpc("delete_current_user_account")

    if (error) {
        console.error("Failed to delete current user account:", error)
        return false
    }

    return true
}

/**
 * 컬렉션(카테고리)을 구독 카탈로그로 발행(공유 활성화).
 * manager/owner만 호출 가능.
 */
export async function publishCollectionAsSubscription(
    supabase: SupabaseClient,
    input: {
        calendarId: string
        collectionId: string
        name: string
        description?: string
        visibility?: "public" | "unlisted"
    }
): Promise<{ catalogId: string; slug: string; created: boolean } | null> {
    const { data, error } = await supabase.rpc(
        "publish_collection_as_subscription",
        {
            target_calendar_id: input.calendarId,
            target_collection_id: input.collectionId,
            p_name: input.name,
            p_description: input.description ?? "",
            p_visibility: input.visibility ?? "public",
        }
    )

    if (error || !data || !Array.isArray(data) || data.length === 0) {
        console.error("Failed to publish collection as subscription:", error)
        return null
    }

    const row = data[0] as {
        catalog_id: string
        slug: string
        created: boolean
    }

    return {
        catalogId: row.catalog_id,
        slug: row.slug,
        created: row.created,
    }
}

/**
 * 컬렉션 공유(구독 발행)를 비활성화. manager/owner만 호출 가능.
 */
export async function unpublishCollectionSubscription(
    supabase: SupabaseClient,
    input: {
        calendarId: string
        collectionId: string
    }
): Promise<boolean> {
    const { data, error } = await supabase.rpc(
        "unpublish_collection_subscription",
        {
            target_calendar_id: input.calendarId,
            target_collection_id: input.collectionId,
        }
    )

    if (error) {
        console.error("Failed to unpublish collection subscription:", error)
        return false
    }

    return Boolean(data)
}

/**
 * 캘린더의 각 카테고리별 공유 발행 상태 조회. manager/owner만 조회 가능.
 */
export async function getCollectionPublishStatus(
    supabase: SupabaseClient,
    calendarId: string
): Promise<
    Array<{
        collectionId: string
        catalogId: string | null
        isPublished: boolean
        visibility: string | null
        status: string | null
        subscriberCount: number
        description: string
    }>
> {
    const { data, error } = await supabase.rpc("get_collection_publish_status", {
        target_calendar_id: calendarId,
    })

    if (error || !data) {
        console.error("Failed to get collection publish status:", error)
        return []
    }

    return (
        data as Array<{
            collection_id: string
            catalog_id: string | null
            is_published: boolean
            visibility: string | null
            status: string | null
            subscriber_count: number
            description: string
        }>
    ).map((row) => ({
        collectionId: row.collection_id,
        catalogId: row.catalog_id,
        isPublished: row.is_published,
        visibility: row.visibility,
        status: row.status,
        subscriberCount: Number(row.subscriber_count),
        description: row.description ?? "",
    }))
}

/**
 * 이미 발행된 컬렉션 구독 카탈로그의 이름·설명·공개 범위를 수정.
 * manager/owner만 호출 가능.
 *
 * @param input.name       구독 카탈로그 표시 이름 (미 입력 시 현재 값 유지)
 * @param input.description 구독 설명 (빈 문자열 허용)
 * @param input.visibility  공개 범위: "public" | "unlisted"
 */
export async function updateCollectionSubscription(
    supabase: SupabaseClient,
    input: {
        calendarId: string
        collectionId: string
        name: string
        description: string
        visibility: "public" | "unlisted"
    }
): Promise<boolean> {
    const { error } = await supabase.rpc("publish_collection_as_subscription", {
        target_calendar_id: input.calendarId,
        target_collection_id: input.collectionId,
        p_name: input.name,
        p_description: input.description,
        p_visibility: input.visibility,
    })

    if (error) {
        console.error("Failed to update collection subscription:", error)
        return false
    }

    return true
}

export async function createCalendarMembership(
    supabase: SupabaseClient,
    calendarId: string
): Promise<CalendarMembership | null> {
    const { data, error } = await supabase
        .rpc("join_public_calendar", {
            target_calendar_id: calendarId,
        })
        .single()

    const membership = data as
        | {
              role: CalendarMembership["role"]
              status: CalendarMembership["status"]
          }
        | null

    if (error || !membership) {
        console.error("Failed to create calendar membership:", error)
        return null
    }

    return {
        isMember: membership.status === "active",
        role: membership.role,
        status: membership.status,
    }
}
