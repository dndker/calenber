import type { SupabaseClient } from "@supabase/supabase-js"

export type MyCalendarItem = {
    id: string
    name: string
    avatarUrl: string | null
    role: string | null
    updatedAt: string
    createdAt: string
}

type CalendarRow = {
    id: string
    name: string
    avatar_url: string | null
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
            "id, name, avatar_url, updated_at, created_at, calendar_members!inner(role)"
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
        updatedAt: calendar.updated_at,
        createdAt: calendar.created_at,
    }))
}
