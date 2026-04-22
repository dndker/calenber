"use client"

import { useCreateEvent } from "@/hooks/use-create-event"
import { getCalendarModalOpenPath } from "@/lib/calendar/modal-route"
import {
    type CalendarEvent,
    defaultContent,
} from "@/store/calendar-store.types"
import { usePathname, useRouter } from "next/navigation"
import { startTransition } from "react"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"

export function useOpenEvent() {
    const pathname = usePathname()
    const router = useRouter()
    const createEvent = useCreateEvent()
    const setActiveEventId = useCalendarStore((s) => s.setActiveEventId)
    const setViewEvent = useCalendarStore((s) => s.setViewEvent)
    const user = useAuthStore((s) => s.user)

    return (payload?: { start?: number; end?: number }) => {
        const id = crypto.randomUUID()
        const now = Date.now()

        const event: CalendarEvent = {
            id,
            title: "",
            content: defaultContent,
            start: payload?.start ?? now,
            end: payload?.end ?? now,
            timezone: "Asia/Seoul",
            categoryIds: [],
            categories: [],
            categoryId: null,
            category: null,
            participants: [],
            status: "scheduled",
            authorId: user?.id ?? null,
            author: user
                ? {
                      id: user.id,
                      name: user.name,
                      email: user.email,
                      avatarUrl: user.avatarUrl,
                  }
                : null,
            updatedById: user?.id ?? null,
            updatedBy: user
                ? {
                      id: user.id,
                      name: user.name,
                      email: user.email,
                      avatarUrl: user.avatarUrl,
                  }
                : null,
            isLocked: false,
            createdAt: now,
            updatedAt: now,
        }

        const createdEventId = createEvent(event)

        if (!createdEventId) {
            return
        }

        setActiveEventId(createdEventId)
        setViewEvent({
            ...event,
            id: createdEventId,
        })
        startTransition(() => {
            router.push(
                getCalendarModalOpenPath({
                    pathname,
                    eventId: createdEventId,
                })
            )
        })
    }
}
