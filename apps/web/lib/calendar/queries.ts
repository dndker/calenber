import {
    mapCalendarEventRecordToCalendarEvent,
    type CalendarEventRecord,
} from "@/lib/calendar/event-record"
import type {
    CalendarAccessMode,
    CalendarMemberStatus,
    CalendarRole,
} from "@/lib/calendar/permissions"
import type { CalendarEventLayout } from "@/lib/calendar/types"
import type { SupabaseClient } from "@supabase/supabase-js"

export type CalendarSummary = {
    id: string
    name: string
    avatarUrl: string | null
    accessMode: CalendarAccessMode
    eventLayout: CalendarEventLayout
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

type CalendarRow = {
    id: string
    name: string
    avatar_url: string | null
    access_mode: CalendarAccessMode
    event_layout: CalendarEventLayout
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
    updated_at: string
    created_at: string
    member_count: number
    creator_user_id: string | null
    creator_name: string | null
    creator_email: string | null
    creator_avatar_url: string | null
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
            "id, name, avatar_url, access_mode, event_layout, updated_at, created_at, calendar_members!inner(role, status)"
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
        updatedAt: calendar.updated_at,
        createdAt: calendar.created_at,
    }))
}

export async function getLatestCalendarIdForUser(
    supabase: SupabaseClient,
    userId: string
): Promise<string | null> {
    const calendars = await getMyCalendars(supabase, userId)
    return calendars[0]?.id ?? null
}

export async function getCalendarById(
    supabase: SupabaseClient,
    calendarId: string
): Promise<CalendarSummary | null> {
    const { data, error } = await supabase
        .from("calendars")
        .select(
            "id, name, avatar_url, access_mode, event_layout, updated_at, created_at"
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
        updatedAt: calendar.updated_at,
        createdAt: calendar.created_at,
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

    return (data as CalendarEventRecord[]).map(
        mapCalendarEventRecordToCalendarEvent
    )
}

export async function getEventById(supabase: SupabaseClient, eventId: string) {
    const { data, error } = await supabase.rpc("get_calendar_event_by_id", {
        target_event_id: eventId,
    })

    if (error || !data || data.length === 0) {
        console.error("Failed to load event:", error)
        return null
    }

    const event = mapCalendarEventRecordToCalendarEvent(
        data[0] as CalendarEventRecord
    )

    return event
}
