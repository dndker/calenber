import {
    createCalendarOgImage,
    ogImageContentType,
    ogImageSize,
} from "@/lib/calendar/og-image"
import {
    getServerEventMetadataByCalendarId,
} from "@/lib/calendar/server-queries"
import {
    demoCalendarSummary,
    getEventOgImageData,
} from "@/lib/calendar/share-metadata"
import { resolveCalendarIdFromPathParam } from "@/lib/calendar/routes"

export const size = ogImageSize
export const contentType = ogImageContentType

export default async function OpenGraphImage({
    params,
}: {
    params: Promise<{ calendarId: string; eventId: string }>
}) {
    const { calendarId: rawCalendarId, eventId } = await params
    const calendarId = resolveCalendarIdFromPathParam(rawCalendarId)
    const { calendar, event } =
        calendarId === "demo"
            ? {
                  calendar: demoCalendarSummary,
                  event: null,
              }
            : await getServerEventMetadataByCalendarId(calendarId, eventId, true)

    return await createCalendarOgImage(getEventOgImageData(calendar, event))
}
