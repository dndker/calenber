import type { SupabaseClient } from "@supabase/supabase-js"
import { serializeEventContent } from "@/lib/calendar/event-content"
import type { CalendarEvent } from "@/store/useCalendarStore"

export async function createCalendarEvent(
    supabase: SupabaseClient,
    calendarId: string,
    event: CalendarEvent
) {
    const { data, error } = await supabase
        .from("events")
        .insert({
            id: event.id,
            calendar_id: calendarId,
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

export async function updateCalendarEvent(
    supabase: SupabaseClient,
    eventId: string,
    patch: Partial<CalendarEvent>
) {
    const updates: Record<string, unknown> = {}

    if (patch.title !== undefined) {
        updates.title = patch.title
    }

    if (patch.content !== undefined) {
        updates.content = serializeEventContent(patch.content)
    }

    if (patch.start !== undefined) {
        updates.start_at = new Date(patch.start).toISOString()
    }

    if (patch.end !== undefined) {
        updates.end_at = new Date(patch.end).toISOString()
    }

    if (Object.keys(updates).length === 0) {
        return true
    }

    const { error } = await supabase
        .from("events")
        .update(updates)
        .eq("id", eventId)

    if (error) {
        console.error("Failed to update calendar event:", error)
        return false
    }

    return true
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
