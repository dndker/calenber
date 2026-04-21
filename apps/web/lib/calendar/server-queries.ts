import { createServerSupabase } from "@/lib/supabase/server"
import { cache } from "react"
import {
    getCalendarById,
    getEventMetadataByCalendarId,
    getEventPageDataByCalendarId,
} from "./queries"

export const getServerCalendarById = cache(async (calendarId: string) => {
    const supabase = await createServerSupabase()

    return getCalendarById(supabase, calendarId)
})

export const getServerEventMetadataByCalendarId = cache(
    async (calendarId: string, eventId: string, silentMissing = false) => {
        const supabase = await createServerSupabase()

        return getEventMetadataByCalendarId(supabase, calendarId, eventId, {
            silentMissing,
        })
    }
)

export const getServerEventPageDataByCalendarId = cache(
    async (calendarId: string, eventId: string, silentMissing = false) => {
        const supabase = await createServerSupabase()

        return getEventPageDataByCalendarId(supabase, calendarId, eventId, {
            silentMissing,
        })
    }
)
