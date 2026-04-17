"use client"

import { canEditCalendarEvent } from "@/lib/calendar/permissions"
import { useCreateEvent } from "@/hooks/use-create-event"
import { CalendarEventPresenceGroup } from "@/components/calendar/calendar-event-presence-group"
import {
    defaultContent,
    type CalendarEvent,
} from "@/store/calendar-store.types"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import { useEffect, useRef, useState } from "react"
import { EventForm } from "./event-form"

export function EventPage({ eventId }: { eventId?: string }) {
    const createEvent = useCreateEvent()
    const updateEvent = useCalendarStore((s) => s.updateEvent)
    const activeCalendar = useCalendarStore((s) => s.activeCalendar)
    const activeCalendarMembership = useCalendarStore(
        (s) => s.activeCalendarMembership
    )
    const user = useAuthStore((s) => s.user)

    // 🔥 현재 사용할 id (new 포함)
    const [localId, setLocalId] = useState<string | undefined>(eventId)

    const hasCreatedRef = useRef(false)

    // 🔥 최초 생성 (new일 때 1번만)
    useEffect(() => {
        if (!eventId && !hasCreatedRef.current) {
            hasCreatedRef.current = true

            const tempEvent: CalendarEvent = {
                id: crypto.randomUUID(),
                title: "",
                content: defaultContent,
                start: Date.now(),
                end: Date.now(),
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
                createdAt: Date.now(),
                updatedAt: Date.now(),
            }

            createEvent(tempEvent).then((ok) => {
                if (ok) {
                    setLocalId(tempEvent.id)
                }
            })
        }
    }, [eventId, createEvent])

    const event = useCalendarStore((s) =>
        localId ? s.events.find((e) => e.id === localId) : undefined
    )

    if (!event) return null

    const canEdit =
        activeCalendar?.id === "demo" ||
        canEditCalendarEvent(event, activeCalendarMembership, user?.id)

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-end">
                <CalendarEventPresenceGroup eventId={event.id} />
            </div>
            <EventForm
                event={event}
                disabled={!canEdit}
                onChange={(patch) => {
                    updateEvent(event.id, patch)
                }}
            />
        </div>
    )
}
