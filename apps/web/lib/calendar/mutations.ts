import type { SupabaseClient } from "@supabase/supabase-js"
import { serializeEventContent } from "@/lib/calendar/event-content"
import {
    mapCalendarEventRecordToCalendarEvent,
    type CalendarEventRecord,
} from "@/lib/calendar/event-record"
import type { CalendarAccessMode } from "@/lib/calendar/permissions"
import type { CalendarMembership } from "@/lib/calendar/queries"
import type { CalendarEvent } from "@/store/calendar-store.types"

export async function createCalendarEvent(
    supabase: SupabaseClient,
    calendarId: string,
    event: CalendarEvent
) {
    const {
        data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
        .from("events")
        .insert({
            id: event.id,
            calendar_id: calendarId,
            created_by: user?.id ?? event.authorId,
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

    if (patch.status !== undefined) {
        updates.status = patch.status
        changedFields.push("status")
    }

    if (patch.isLocked !== undefined) {
        updates.is_locked = patch.isLocked
        changedFields.push("is_locked")
    }

    if (Object.keys(updates).length === 0) {
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
