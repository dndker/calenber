import { getServerUser } from "@/lib/auth/get-server-user"
import { createServerSupabase } from "@/lib/supabase/server"
import { cache } from "react"
import {
    getCalendarById,
    getCalendarInitialData,
    getEventMetadataByCalendarId,
    getEventPageDataByCalendarId,
    getMyCalendars,
} from "./queries"

export const getServerCalendarById = cache(async (calendarId: string) => {
    const supabase = await createServerSupabase()

    return getCalendarById(supabase, calendarId)
})

export const getServerEventMetadataByCalendarId = cache(
    async (calendarId: string, eventId: string, silentMissing = false) => {
        const user = await getServerUser()
        const supabase = await createServerSupabase()

        return getEventMetadataByCalendarId(supabase, calendarId, eventId, {
            silentMissing,
            viewerUserId: user?.id,
        })
    }
)

export const getServerCalendarInitialData = cache(
    async (calendarId: string) => {
        const supabase = await createServerSupabase()

        return getCalendarInitialData(supabase, calendarId)
    }
)

export const getServerMyCalendars = cache(async () => {
    const user = await getServerUser()

    if (!user) {
        return []
    }

    const supabase = await createServerSupabase()

    return getMyCalendars(supabase, user.id)
})

export const getServerEventPageDataByCalendarId = cache(
    async (calendarId: string, eventId: string, silentMissing = false) => {
        const user = await getServerUser()
        const supabase = await createServerSupabase()

        return getEventPageDataByCalendarId(supabase, calendarId, eventId, {
            silentMissing,
            viewerUserId: user?.id,
        })
    }
)
