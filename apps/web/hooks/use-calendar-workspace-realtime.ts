"use client"

import {
    mapCalendarEventRecordToCalendarEvent,
    type CalendarEventRecord,
} from "@/lib/calendar/event-record"
import {
    CALENDAR_WORKSPACE_REALTIME_EVENTS,
    getCalendarWorkspaceTopic,
    type CalendarEventRealtimePayload,
    type CalendarWorkspacePresencePayload,
} from "@/lib/calendar/realtime"
import { createBrowserSupabase } from "@/lib/supabase/client"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import { useEffect } from "react"

type CalendarBroadcastMessage = {
    payload?: CalendarEventRealtimePayload
}

const ANONYMOUS_PRESENCE_ID_STORAGE_KEY = "calendar-workspace-anonymous-id"
const IS_DEV = process.env.NODE_ENV === "development"

function getAnonymousPresenceId() {
    if (typeof window === "undefined") {
        return `anon:${crypto.randomUUID()}`
    }

    const existing = window.sessionStorage.getItem(
        ANONYMOUS_PRESENCE_ID_STORAGE_KEY
    )

    if (existing) {
        return existing
    }

    const nextId = `anon:${crypto.randomUUID()}`
    window.sessionStorage.setItem(ANONYMOUS_PRESENCE_ID_STORAGE_KEY, nextId)
    return nextId
}

function getAnonymousPresenceName(id: string) {
    return `익명 ${id.slice(-4).toUpperCase()}`
}

function isCalendarWorkspacePresencePayload(
    value: unknown
): value is CalendarWorkspacePresencePayload {
    if (!value || typeof value !== "object") {
        return false
    }

    const candidate = value as Partial<CalendarWorkspacePresencePayload>

    return (
        typeof candidate.id === "string" &&
        typeof candidate.displayName === "string" &&
        typeof candidate.isAnonymous === "boolean" &&
        typeof candidate.joinedAt === "string"
    )
}

export function useCalendarWorkspaceRealtime() {
    const activeCalendar = useCalendarStore((state) => state.activeCalendar)
    const calendarId = activeCalendar?.id
    const upsertEventSnapshot = useCalendarStore(
        (state) => state.upsertEventSnapshot
    )
    const removeEventSnapshot = useCalendarStore((state) => state.removeEventSnapshot)
    const setWorkspacePresence = useCalendarStore(
        (state) => state.setWorkspacePresence
    )
    const user = useAuthStore((state) => state.user)
    const isAuthLoading = useAuthStore((state) => state.isLoading)

    useEffect(() => {
        if (!calendarId || calendarId === "demo" || isAuthLoading) {
            return
        }

        const supabase = createBrowserSupabase()
        const topic = getCalendarWorkspaceTopic(calendarId)
        const isPrivateChannel = activeCalendar?.accessMode === "private"
        const presenceId = user?.id ?? getAnonymousPresenceId()
        const presencePayload: CalendarWorkspacePresencePayload = {
            id: presenceId,
            displayName: user?.name?.trim() || getAnonymousPresenceName(presenceId),
            avatarUrl: user?.avatarUrl ?? null,
            isAnonymous: !user,
            joinedAt: new Date().toISOString(),
        }
        let isDisposed = false
        let channel: ReturnType<typeof supabase.channel> | null = null

        const handleEventBroadcast = (message: CalendarBroadcastMessage) => {
            const payload = message.payload

            if (!payload || payload.entity !== "event") {
                return
            }

            if (payload.operation === "delete") {
                removeEventSnapshot(payload.eventId)
                return
            }

            const record = payload.record as CalendarEventRecord | undefined

            if (!record) {
                return
            }

            upsertEventSnapshot(mapCalendarEventRecordToCalendarEvent(record))
        }

        const syncWorkspacePresence = () => {
            if (!channel) {
                return
            }

            const presenceState = channel.presenceState() as Record<
                string,
                unknown[]
            >
            const nextMembers = Object.values(presenceState)
                .flat()
                .filter(isCalendarWorkspacePresencePayload)
                .map((member) => ({
                    id: member.id,
                    displayName: member.displayName,
                    avatarUrl: member.avatarUrl ?? null,
                    isAnonymous: member.isAnonymous,
                    joinedAt: member.joinedAt,
                }))
                .sort((a, b) => {
                    if (a.isAnonymous !== b.isAnonymous) {
                        return a.isAnonymous ? 1 : -1
                    }

                    return a.joinedAt.localeCompare(b.joinedAt)
                })
                .map(({ joinedAt: _joinedAt, ...member }) => member)

            setWorkspacePresence(nextMembers)
        }

        const subscribeToWorkspace = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession()

            if (isDisposed) {
                return
            }

            if (isPrivateChannel && !session?.access_token) {
                return
            }

            if (session?.access_token) {
                await supabase.realtime.setAuth(session.access_token)
            } else if (isPrivateChannel) {
                await supabase.realtime.setAuth()
            }

            const nextChannel = supabase.channel(topic, {
                config: {
                    private: isPrivateChannel,
                    broadcast: {
                        self: false,
                    },
                    presence: {
                        key: presenceId,
                    },
                },
            })

            channel = nextChannel

            ;(nextChannel as any)
                .on(
                    "broadcast",
                    {
                        event: CALENDAR_WORKSPACE_REALTIME_EVENTS.created,
                    },
                    handleEventBroadcast
                )
                .on(
                    "broadcast",
                    {
                        event: CALENDAR_WORKSPACE_REALTIME_EVENTS.updated,
                    },
                    handleEventBroadcast
                )
                .on(
                    "broadcast",
                    {
                        event: CALENDAR_WORKSPACE_REALTIME_EVENTS.deleted,
                    },
                    handleEventBroadcast
                )
                .on("presence", { event: "sync" }, syncWorkspacePresence)
                .on("presence", { event: "join" }, syncWorkspacePresence)
                .on("presence", { event: "leave" }, syncWorkspacePresence)
                .subscribe(async (status: string) => {
                    if (IS_DEV) {
                        console.log("[calendar-workspace-realtime]", {
                            topic,
                            status,
                            isPrivateChannel,
                            hasSession: Boolean(session?.access_token),
                        })
                    }

                    if (status !== "SUBSCRIBED" || !nextChannel || isDisposed) {
                        return
                    }

                    await nextChannel.track(presencePayload)
                })
        }

        void subscribeToWorkspace()

        return () => {
            isDisposed = true
            setWorkspacePresence([])

            if (channel) {
                void supabase.removeChannel(channel)
            }
        }
    }, [
        calendarId,
        activeCalendar?.accessMode,
        isAuthLoading,
        removeEventSnapshot,
        setWorkspacePresence,
        upsertEventSnapshot,
        user,
    ])
}
