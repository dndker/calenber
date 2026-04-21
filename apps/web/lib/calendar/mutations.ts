import type { SupabaseClient } from "@supabase/supabase-js"
import { serializeEventContent } from "@/lib/calendar/event-content"
import {
    mapCalendarEventRecordToCalendarEvent,
    type CalendarEventRecord,
} from "@/lib/calendar/event-record"
import type { CalendarAccessMode } from "@/lib/calendar/permissions"
import type { CalendarMembership } from "@/lib/calendar/queries"
import type {
    CalendarEvent,
    CalendarEventCategory,
} from "@/store/calendar-store.types"

type CalendarEventCategoryRow = {
    id: string
    calendar_id: string
    name: string
    options: {
        visibleByDefault?: boolean
    } | null
    created_by: string | null
    created_at: string
    updated_at: string
}

function normalizeEventCategoryOptions(
    options?: Partial<CalendarEventCategory["options"]> | null
) {
    return {
        visibleByDefault: options?.visibleByDefault !== false,
    }
}

function mapCalendarEventCategoryRow(
    category: CalendarEventCategoryRow
): CalendarEventCategory {
    return {
        id: category.id,
        calendarId: category.calendar_id,
        name: category.name,
        options: normalizeEventCategoryOptions(category.options),
        createdById: category.created_by,
        createdAt: new Date(category.created_at).valueOf(),
        updatedAt: new Date(category.updated_at).valueOf(),
    }
}

async function ensureCalendarEventCategory(
    supabase: SupabaseClient,
    calendarId: string,
    input: CalendarEvent["category"]
) {
    const trimmedName = input?.name?.trim()

    if (!trimmedName) {
        return null
    }

    if (input?.id) {
        return input.id
    }

    const { data, error } = await supabase.rpc(
        "upsert_calendar_event_category",
        {
            target_calendar_id: calendarId,
            target_name: trimmedName,
        }
    )

    if (error || !data) {
        console.error("Failed to ensure calendar event category:", error)
        return null
    }

    return typeof data === "string" ? data : null
}

async function ensureCalendarEventCategories(
    supabase: SupabaseClient,
    calendarId: string,
    inputs: CalendarEvent["categories"]
) {
    const entries = await Promise.all(
        inputs.map(async (category) => {
            const categoryId =
                category.id ||
                (await ensureCalendarEventCategory(
                    supabase,
                    calendarId,
                    category
                ))

            return categoryId
                ? {
                      ...category,
                      id: categoryId,
                      calendarId,
                  }
                : null
        })
    )

    return entries.filter(
        (category): category is NonNullable<(typeof entries)[number]> =>
            Boolean(category)
    )
}

async function replaceCalendarEventCategories(
    supabase: SupabaseClient,
    eventId: string,
    categoryIds: string[]
) {
    const uniqueCategoryIds = Array.from(new Set(categoryIds.filter(Boolean)))

    const { error } = await supabase.rpc("replace_calendar_event_categories", {
        target_event_id: eventId,
        target_category_ids: uniqueCategoryIds,
    })

    if (error) {
        console.error("Failed to replace calendar event categories:", error)
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

export async function createCalendarEventCategory(
    supabase: SupabaseClient,
    calendarId: string,
    input: {
        name: string
        options?: Partial<CalendarEventCategory["options"]>
    }
) {
    const trimmedName = input.name.trim()

    if (!trimmedName) {
        return null
    }

    const normalizedOptions = normalizeEventCategoryOptions(input.options)
    const { data: categoryId, error: upsertError } = await supabase.rpc(
        "upsert_calendar_event_category",
        {
            target_calendar_id: calendarId,
            target_name: trimmedName,
            target_options: normalizedOptions,
        }
    )

    if (upsertError || !categoryId) {
        console.error("Failed to create calendar event category:", upsertError)
        return null
    }

    const { data, error } = await supabase
        .from("event_categories")
        .select(
            "id, calendar_id, name, options, created_by, created_at, updated_at"
        )
        .eq("id", categoryId)
        .single()

    if (error || !data) {
        console.error(
            "Failed to fetch created calendar event category:",
            error
        )
        return null
    }

    return mapCalendarEventCategoryRow(data as CalendarEventCategoryRow)
}

export async function updateCalendarEventCategory(
    supabase: SupabaseClient,
    categoryId: string,
    patch: {
        name?: string
        options?: Partial<CalendarEventCategory["options"]>
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
        updates.options = normalizeEventCategoryOptions(patch.options)
    }

    if (Object.keys(updates).length === 0) {
        return null
    }

    const { data, error } = await supabase
        .from("event_categories")
        .update(updates)
        .eq("id", categoryId)
        .select(
            "id, calendar_id, name, options, created_by, created_at, updated_at"
        )
        .single()

    if (error || !data) {
        console.error("Failed to update calendar event category:", error)
        return null
    }

    return mapCalendarEventCategoryRow(data as CalendarEventCategoryRow)
}

export async function deleteCalendarEventCategory(
    supabase: SupabaseClient,
    categoryId: string
) {
    const { data, error } = await supabase.rpc("delete_calendar_event_category", {
        target_category_id: categoryId,
    })

    if (error) {
        console.error("Failed to delete calendar event category:", error)
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
    const ensuredCategories = await ensureCalendarEventCategories(
        supabase,
        calendarId,
        event.categories
    )
    const primaryCategoryId =
        ensuredCategories[0]?.id ?? event.categoryId ?? event.category?.id ?? null
    const categoryIdsToSync =
        ensuredCategories.length > 0
            ? ensuredCategories.map((category) => category.id)
            : primaryCategoryId
              ? [primaryCategoryId]
              : []

    const { data, error } = await supabase
        .from("events")
        .insert({
            id: event.id,
            calendar_id: calendarId,
            created_by: user?.id ?? event.authorId,
            category_id: primaryCategoryId,
            recurrence: event.recurrence ?? null,
            exceptions: event.exceptions ?? [],
            status: event.status,
            is_locked: event.isLocked,
            title: event.title,
            content: serializeEventContent(event.content),
            start_at: new Date(event.start).toISOString(),
            end_at: new Date(event.end).toISOString(),
        })
        .select("id")
        .single()

    if (error || !data) {
        console.error("Failed to create calendar event:", error)
        return null
    }

    if (categoryIdsToSync.length > 0) {
        const syncedCategories = await replaceCalendarEventCategories(
            supabase,
            event.id,
            categoryIdsToSync
        )

        if (!syncedCategories) {
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

    return { id: calendarId }
}

export async function updateCalendarEvent(
    supabase: SupabaseClient,
    eventId: string,
    patch: Partial<CalendarEvent>,
    options?: {
        expectedUpdatedAt?: number
    }
) {
    const updates: Record<string, unknown> = {}
    const changedFields: string[] = []
    let resolvedCategoryId = patch.categoryId
    let resolvedCategories = patch.categories

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

    if (
        patch.categories !== undefined ||
        patch.categoryIds !== undefined ||
        patch.category !== undefined ||
        patch.categoryId !== undefined
    ) {
        if (
            patch.categories?.length === 0 ||
            patch.categoryIds?.length === 0 ||
            patch.category === null ||
            patch.categoryId === null
        ) {
            resolvedCategoryId = null
            resolvedCategories = []
        } else if (
            patch.categories &&
            patch.categories.length > 0 &&
            patch.categoryIds === undefined
        ) {
            const { data: eventRow, error: eventError } = await supabase
                .from("events")
                .select("calendar_id")
                .eq("id", eventId)
                .single()

            if (eventError || !eventRow?.calendar_id) {
                console.error("Failed to resolve event calendar for category:", eventError)
                return {
                    ok: false as const,
                    status: "error" as const,
                    event: null,
                    conflictingFields: [],
                }
            }

            resolvedCategories = await ensureCalendarEventCategories(
                supabase,
                eventRow.calendar_id as string,
                patch.categories
            )

            if (
                patch.categories.some((category) => category.name.trim()) &&
                resolvedCategories.length === 0
            ) {
                return {
                    ok: false as const,
                    status: "error" as const,
                    event: null,
                    conflictingFields: [],
                }
            }

            resolvedCategoryId = resolvedCategories[0]?.id ?? null
        } else if (patch.categoryIds && patch.categoryIds.length > 0) {
            resolvedCategoryId = patch.categoryIds[0] ?? null
        }

        updates.category_id = resolvedCategoryId
        changedFields.push("categories")
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

        if (
            patch.categories !== undefined ||
            patch.categoryIds !== undefined ||
            patch.category !== undefined ||
            patch.categoryId !== undefined
        ) {
            const syncedCategories = await replaceCalendarEventCategories(
                supabase,
                eventId,
                resolvedCategories?.map((category) => category.id) ??
                    patch.categoryIds ??
                    []
            )

            if (!syncedCategories) {
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
        (
            patch.categories !== undefined ||
            patch.categoryIds !== undefined ||
            patch.category !== undefined ||
            patch.categoryId !== undefined
        )
    ) {
        const syncedCategories = await replaceCalendarEventCategories(
            supabase,
            eventId,
            resolvedCategories?.map((category) => category.id) ??
                patch.categoryIds ??
                []
        )

        if (!syncedCategories) {
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
