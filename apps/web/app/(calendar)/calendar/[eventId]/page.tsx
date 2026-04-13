import { EventPage } from "@/components/calendar/event-page"

export default function Page({ params }: { params: { e: string } }) {
    return (
        <div className="p-6">
            <EventPage eventId={params.e} />
        </div>
    )
}
