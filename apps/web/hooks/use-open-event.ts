"use client"

import { useCreateEvent } from "@/hooks/use-create-event"
import { navigateCalendarModal } from "@/lib/calendar/modal-navigation"
import {
    type OpenEventSchedulePayload,
    resolveOpenEventSchedule,
} from "@/lib/calendar/default-timed-schedule"
import { getCalendarModalOpenPath } from "@/lib/calendar/modal-route"
import {
    type CalendarEvent,
    defaultContent,
} from "@/store/calendar-store.types"
import { usePathname } from "next/navigation"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"

export function useOpenEvent() {
    const pathname = usePathname()
    const createEvent = useCreateEvent()
    const setActiveEventId = useCalendarStore((s) => s.setActiveEventId)
    const setViewEvent = useCalendarStore((s) => s.setViewEvent)
    const calendarTimezone = useCalendarStore((s) => s.calendarTimezone)
    const user = useAuthStore((s) => s.user)

    return (payload?: OpenEventSchedulePayload) => {
        const id = crypto.randomUUID()
        const now = Date.now()
        const tz = calendarTimezone || "Asia/Seoul"
        const range = resolveOpenEventSchedule(tz, payload)

        const event: CalendarEvent = {
            id,
            title: "",
            content: defaultContent,
            start: range.start.getTime(),
            end: range.end.getTime(),
            allDay: false,
            timezone: tz,
            categoryIds: [],
            categories: [],
            categoryId: null,
            category: null,
            participants: [],
            isFavorite: false,
            favoritedAt: null,
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
        navigateCalendarModal(
            getCalendarModalOpenPath({
                pathname,
                eventId: createdEventId,
            })
        )
    }
}
