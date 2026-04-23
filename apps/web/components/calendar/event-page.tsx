"use client"

import { useCalendarEventDetail } from "@/hooks/use-calendar-event-detail"
import { useCreateEvent } from "@/hooks/use-create-event"
import { useEventDeleteAction } from "@/hooks/use-event-delete-action"
import { canEditCalendarEvent } from "@/lib/calendar/permissions"
import { getCalendarBasePath } from "@/lib/calendar/routes"
import {
    getCalendarShareTitle,
    getEventShareTitle,
} from "@/lib/calendar/share-metadata"
import { APP_NAME } from "@/lib/app-config"
import {
    defaultContent,
    type CalendarEvent,
} from "@/store/calendar-store.types"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { EventForm } from "./event-form"
import { EventHeader } from "./event-header"

export function EventPage({
    modal = false,
    eventId,
    initialEvent,
}: {
    modal?: boolean
    eventId?: string
    initialEvent?: CalendarEvent | null
}) {
    const router = useRouter()
    const pathname = usePathname()
    const basePath = getCalendarBasePath(pathname)

    const createEvent = useCreateEvent()
    const updateEvent = useCalendarStore((s) => s.updateEvent)
    const activeCalendar = useCalendarStore((s) => s.activeCalendar)
    const calendarTimezone = useCalendarStore((s) => s.calendarTimezone)
    const activeCalendarMembership = useCalendarStore(
        (s) => s.activeCalendarMembership
    )
    const user = useAuthStore((s) => s.user)

    // 🔥 현재 사용할 id (new 포함)
    const [localId, setLocalId] = useState<string | undefined>(eventId)

    const effectiveId = eventId ?? localId

    const hasCreatedRef = useRef(false)
    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
        null
    )

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
                timezone: calendarTimezone || "Asia/Seoul",
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
                createdAt: Date.now(),
                updatedAt: Date.now(),
            }

            const createdEventId = createEvent(tempEvent)

            if (createdEventId) {
                setLocalId(createdEventId)
            }
        }
    }, [calendarTimezone, eventId, createEvent, user])

    const { event, isLoading, isMissing } = useCalendarEventDetail({
        eventId: effectiveId,
        initialEvent,
    })

    useEffect(() => {
        if (!event) {
            return
        }

        const nextTitle = getEventShareTitle(event, activeCalendar)
        document.title =
            nextTitle === APP_NAME ? APP_NAME : `${nextTitle} - ${APP_NAME}`

        return () => {
            const calendarTitle = getCalendarShareTitle(activeCalendar)
            document.title =
                calendarTitle === APP_NAME
                    ? APP_NAME
                    : `${calendarTitle} - ${APP_NAME}`
        }
    }, [activeCalendar, event])

    const handleDeleteEvent = useEventDeleteAction({
        eventId: effectiveId,
        onSuccess: () => {
            router.replace(basePath)
        },
    })

    if (isLoading && !event) {
        return (
            <div className="flex flex-col gap-4">
                {!modal && <Skeleton className="h-12 w-full rounded-xl" />}
                <div className="flex flex-col gap-3">
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <Skeleton className="h-30 w-full rounded-xl" />
                    <Skeleton className="h-56 w-full rounded-xl" />
                </div>
            </div>
        )
    }

    if (isMissing) {
        return (
            <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                일정을 찾을 수 없습니다.
            </div>
        )
    }

    if (!event) return null

    const canEdit =
        activeCalendar?.id === "demo" ||
        canEditCalendarEvent(event, activeCalendarMembership, user?.id)

    return (
        <div
            className="cb-event-page flex flex-col gap-4"
            ref={(node) => {
                setPortalContainer(node)
            }}
        >
            {!modal && (
                <EventHeader
                    id={effectiveId}
                    event={event}
                    modal={modal}
                    onDeleteEvent={handleDeleteEvent}
                    portalContainer={portalContainer}
                />
            )}

            <EventForm
                key={event.id}
                modal={modal}
                event={event}
                disabled={!canEdit}
                portalContainer={portalContainer}
                onChange={(patch, options) => {
                    updateEvent(event.id, patch, options)
                }}
            />
        </div>
    )
}
