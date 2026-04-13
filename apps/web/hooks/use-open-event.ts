"use client"

import { useCreateEvent } from "@/hooks/use-create-event"
import { CalendarEvent } from "@/store/useCalendarStore"
import { nanoid } from "nanoid"
import { useRouter } from "next/navigation"

export function useOpenEvent() {
    const router = useRouter()
    const createEvent = useCreateEvent()

    return async (payload?: { start?: number; end?: number }) => {
        const id = nanoid()
        const now = Date.now()

        const event: CalendarEvent = {
            id,
            title: "",
            description: "",
            start: payload?.start ?? now,
            end: payload?.end ?? now,
            timezone: "Asia/Seoul",
            color: "blue",
            createdAt: now,
            updatedAt: now,
        }

        await createEvent(event)

        router.push(`/calendar?e=${id}`)
    }
}
