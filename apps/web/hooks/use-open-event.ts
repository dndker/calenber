"use client"

import { useCreateEvent } from "@/hooks/use-create-event"
import { getCalendarBasePath } from "@/lib/calendar/routes"
import {
    type CalendarEvent,
    defaultContent,
} from "@/store/calendar-store.types"
import { usePathname, useRouter } from "next/navigation"
import { startTransition } from "react"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"

export function useOpenEvent() {
    const router = useRouter()
    const pathname = usePathname()
    const createEvent = useCreateEvent()
    const setActiveEventId = useCalendarStore((s) => s.setActiveEventId)
    const user = useAuthStore((s) => s.user)

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
            isLocked: false,
            createdAt: now,
            updatedAt: now,
        }

        const ok = await createEvent(event)

        if (!ok) {
            return
        }

        setActiveEventId(id)
        startTransition(() => {
            router.push(
                `${getCalendarBasePath(pathname)}?e=${encodeURIComponent(id)}`
            )
        })
    }
}
