import { CalendarPageContent } from "@/components/calendar/calendar-page-content"

export default async function Page({
    searchParams,
}: {
    params: Promise<{ calendarId: string }>
    searchParams: Promise<{ e?: string }>
}) {
    const { e } = await searchParams

    return <CalendarPageContent eventId={e} />
}
