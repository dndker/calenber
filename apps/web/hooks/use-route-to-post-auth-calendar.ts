"use client"

import { resolvePostAuthCalendarPath } from "@/lib/calendar/resolve-post-auth-calendar-path"
import { useRouter } from "next/navigation"

export function useRouteToPostAuthCalendar() {
    const router = useRouter()

    return async () => {
        const calendarPath = await resolvePostAuthCalendarPath()
        router.replace(calendarPath)
        router.refresh()
    }
}
