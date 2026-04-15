"use client"

import { useCreateEvent } from "@/hooks/use-create-event"
import { getCalendarBasePath } from "@/lib/calendar/routes"
import { CalendarEvent, defaultContent } from "@/store/useCalendarStore"
import { usePathname, useRouter } from "next/navigation"
import { startTransition } from "react"
import { useCalendarStore } from "@/store/useCalendarStore"

export function useOpenEvent() {
    const router = useRouter()
    const pathname = usePathname()
    const createEvent = useCreateEvent()
    const setActiveEventId = useCalendarStore((s) => s.setActiveEventId)

    return async (payload?: { start?: number; end?: number }) => {
        const id = crypto.randomUUID()
        const now = Date.now()

        const event: CalendarEvent = {
            id,
            title: "",
            content: defaultContent,
            start: payload?.start ?? now,
            end: payload?.end ?? now,
            timezone: "Asia/Seoul",
            color: "blue",
            createdAt: now,
            updatedAt: now,
        }

        setActiveEventId(id)
        await createEvent(event)
        startTransition(() => {
            router.push(
                `${getCalendarBasePath(pathname)}?e=${encodeURIComponent(id)}`
            )
        })
    }
}
