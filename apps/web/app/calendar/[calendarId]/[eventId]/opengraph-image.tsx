import {
    getCalendarById,
    getEventById,
} from "@/lib/calendar/queries"
import {
    createCalendarOgImage,
    ogImageContentType,
    ogImageSize,
} from "@/lib/calendar/og-image"
import {
    demoCalendarSummary,
    getEventOgImageData,
} from "@/lib/calendar/share-metadata"
import { createServerSupabase } from "@/lib/supabase/server"

export const size = ogImageSize
export const contentType = ogImageContentType

export default async function OpenGraphImage({
    params,
}: {
    params: Promise<{ calendarId: string; eventId: string }>
}) {
    const { calendarId, eventId } = await params
    const supabase = await createServerSupabase()
    const [calendar, event] = await Promise.all([
        calendarId === "demo"
            ? Promise.resolve(demoCalendarSummary)
            : getCalendarById(supabase, calendarId),
        getEventById(supabase, eventId, { silentMissing: true }),
    ])

    return await createCalendarOgImage(getEventOgImageData(calendar, event))
}
