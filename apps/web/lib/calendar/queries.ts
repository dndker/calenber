import type { SupabaseClient } from "@supabase/supabase-js"
import { parseEventContent } from "@/lib/calendar/event-content"
import type { CalendarEventLayout } from "@/lib/calendar/types"
import type { CalendarEvent } from "@/store/useCalendarStore"

export type CalendarSummary = {
    id: string
    name: string
    avatarUrl: string | null
    eventLayout: CalendarEventLayout
    updatedAt: string
    createdAt: string
}

export type MyCalendarItem = CalendarSummary & {
    role: string | null
}

export type CalendarMembership = {
    isMember: boolean
    role: string | null
}

type EventRow = {
    id: string
    title: string
    content: CalendarEvent["content"] | string | null
    start_at: string | null
    end_at: string | null
    created_at: string
}

type CalendarRow = {
    id: string
    name: string
    avatar_url: string | null
    event_layout: CalendarEventLayout
    updated_at: string
    created_at: string
    calendar_members:
        | {
              role: string | null
          }[]
        | null
}

export async function getMyCalendars(
    supabase: SupabaseClient,
    userId: string
): Promise<MyCalendarItem[]> {
    const { data, error } = await supabase
        .from("calendars")
        .select(
            "id, name, avatar_url, event_layout, updated_at, created_at, calendar_members!inner(role)"
        )
        .eq("calendar_members.user_id", userId)
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false })

    if (error || !data) {
        console.error("Failed to load calendars:", error)
        return []
    }

    return (data as unknown as CalendarRow[]).map((calendar) => ({
        id: calendar.id,
        name: calendar.name,
        avatarUrl: calendar.avatar_url,
        role: calendar.calendar_members?.[0]?.role ?? null,
        eventLayout: calendar.event_layout,
        updatedAt: calendar.updated_at,
        createdAt: calendar.created_at,
    }))
}

export async function getCalendarById(
    supabase: SupabaseClient,
    calendarId: string
): Promise<CalendarSummary | null> {
    const { data, error } = await supabase
        .from("calendars")
        .select("id, name, avatar_url, event_layout, updated_at, created_at")
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
        eventLayout: calendar.event_layout,
        updatedAt: calendar.updated_at,
        createdAt: calendar.created_at,
    }
}

function mapEventRowToCalendarEvent(event: EventRow): CalendarEvent {
    const start = event.start_at ? new Date(event.start_at).valueOf() : Date.now()
    const end = event.end_at ? new Date(event.end_at).valueOf() : start

    return {
        id: event.id,
        title: event.title,
        content: parseEventContent(event.content),
        start,
        end,
        allDay: true,
        timezone: "Asia/Seoul",
        color: "#3b82f6",
        createdAt: new Date(event.created_at).valueOf(),
        updatedAt: new Date(event.created_at).valueOf(),
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
        }
    }

    const { data, error } = await supabase
        .from("calendar_members")
        .select("role")
        .eq("calendar_id", calendarId)
        .eq("user_id", userId)
        .maybeSingle()

    if (error) {
        console.error("Failed to load calendar membership:", error)
        return {
            isMember: false,
            role: null,
        }
    }

    return {
        isMember: !!data,
        role: data?.role ?? null,
    }
}

export async function getCalendarEvents(
    supabase: SupabaseClient,
    calendarId: string
) {
    const { data, error } = await supabase
        .from("events")
        .select("id, title, content, start_at, end_at, created_at")
        .eq("calendar_id", calendarId)
        .order("start_at", { ascending: true })
        .order("created_at", { ascending: true })

    if (error || !data) {
        console.error("Failed to load calendar events:", error)
        return []
    }

    return (data as EventRow[]).map(mapEventRowToCalendarEvent)
}
