"use client"

import { EventModal } from "@/components/calendar/event-modal"
import MonthView from "@/components/calendar/month-view"
import { useSearchParams } from "next/navigation"

export default function Page() {
    const searchParams = useSearchParams()
    const e = searchParams.get("e") ?? undefined

    return (
        <>
            <MonthView />

            <EventModal e={e} />
        </>
    )
}
