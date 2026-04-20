import { getCalendarById } from "@/lib/calendar/queries"
import {
    createCalendarOgImage,
    ogImageContentType,
    ogImageSize,
} from "@/lib/calendar/og-image"
import {
    demoCalendarSummary,
    getCalendarOgImageData,
} from "@/lib/calendar/share-metadata"
import { createServerSupabase } from "@/lib/supabase/server"

export const size = ogImageSize
export const contentType = ogImageContentType

export default async function OpenGraphImage({
    params,
}: {
    params: Promise<{ calendarId: string }>
}) {
    const { calendarId } = await params
    const supabase = await createServerSupabase()
    const calendar =
        calendarId === "demo"
            ? demoCalendarSummary
            : await getCalendarById(supabase, calendarId)

    return await createCalendarOgImage(getCalendarOgImageData(calendar))
}
