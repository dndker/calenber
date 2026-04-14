"use client"

import { useCreateEvent } from "@/hooks/use-create-event"
import { CalendarEvent, defaultContent } from "@/store/useCalendarStore"
import { nanoid } from "nanoid"
import { useRouter } from "next/navigation"
import { startTransition } from "react"
import { useCalendarStore } from "@/store/useCalendarStore"

export function useOpenEvent() {
    const router = useRouter()
    const createEvent = useCreateEvent()
    const setActiveEventId = useCalendarStore((s) => s.setActiveEventId)

    return async (payload?: { start?: number; end?: number }) => {
        const id = nanoid()
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
            router.push(`/calendar?e=${id}`)
        })
    }
}
