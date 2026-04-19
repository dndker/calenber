import { EventPageContent } from "@/components/calendar/event-page-content"

export default async function Page({
    params,
}: {
    params: Promise<{ eventId: string }>
}) {
    const { eventId } = await params

    // const supabase = await createServerSupabase()
    // const event = await getEventById(supabase, eventId)

    // useEffect(() => {
    //     useCalendarStore.setState({ activeEventId: eventId })
    // }, [eventId])

    return <EventPageContent eventId={eventId} />
}
