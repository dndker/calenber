import { EventPage } from "@/components/calendar/event-page"

export default async function Page({
    params,
}: {
    params: Promise<{ eventId: string }>
}) {
    const { eventId } = await params

    return (
        <div className="mx-auto w-full max-w-180.75 px-3 py-3 sm:py-25">
            <EventPage eventId={eventId} />
        </div>
    )
}
