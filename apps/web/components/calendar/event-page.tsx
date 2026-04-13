"use client"

import { useCreateEvent } from "@/hooks/use-create-event"
import { CalendarEvent, useCalendarStore } from "@/store/useCalendarStore"
import { nanoid } from "nanoid"
import { useEffect, useRef, useState } from "react"
import { EventForm } from "./event-form"

export function EventPage({ eventId }: { eventId?: string }) {
    const createEvent = useCreateEvent()
    const updateEvent = useCalendarStore((s) => s.updateEvent)

    // 🔥 현재 사용할 id (new 포함)
    const [localId, setLocalId] = useState<string | undefined>(eventId)

    const hasCreatedRef = useRef(false)

    // 🔥 최초 생성 (new일 때 1번만)
    useEffect(() => {
        if (!eventId && !hasCreatedRef.current) {
            hasCreatedRef.current = true

            const tempEvent: CalendarEvent = {
                id: nanoid(), // 임시 id
                title: "",
                description: "",
                start: Date.now(),
                end: Date.now(),
                timezone: "Asia/Seoul",
                color: "blue",
                createdAt: Date.now(),
                updatedAt: Date.now(),
            }

            createEvent(tempEvent).then(() => {
                setLocalId(tempEvent.id)
            })
        }
    }, [eventId, createEvent])

    const event = useCalendarStore((s) =>
        localId ? s.events.find((e) => e.id === localId) : undefined
    )

    if (!event) return null

    return (
        <EventForm
            event={event}
            onChange={(patch) => {
                // 🔥 무조건 update만
                console.log(event.id, patch)
                updateEvent(event.id, patch)
            }}
        />
    )
}
