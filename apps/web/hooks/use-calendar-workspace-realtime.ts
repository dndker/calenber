"use client"

import {
    mapCalendarEventRecordToCalendarEvent,
    type CalendarEventRecord,
} from "@/lib/calendar/event-record"
import {
    CALENDAR_WORKSPACE_REALTIME_EVENTS,
    CALENDAR_WORKSPACE_REALTIME_RECOVERABLE_STATUSES,
    CALENDAR_WORKSPACE_REALTIME_RETRY_DELAYS_MS,
    getCalendarWorkspaceTopic,
    type CalendarEventRealtimePayload,
    type CalendarWorkspaceRealtimeStatus,
    type CalendarWorkspacePresencePayload,
} from "@/lib/calendar/realtime"
import { createBrowserSupabase } from "@/lib/supabase/client"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import type {
    AuthChangeEvent,
    RealtimeChannel,
    Session,
} from "@supabase/supabase-js"
import { useEffect, useRef } from "react"

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
    const accessMode = activeCalendar?.accessMode
    const upsertEventSnapshot = useCalendarStore(
        (state) => state.upsertEventSnapshot
    )
    const removeEventSnapshot = useCalendarStore((state) => state.removeEventSnapshot)
    const setWorkspacePresence = useCalendarStore(
        (state) => state.setWorkspacePresence
    )
    const user = useAuthStore((state) => state.user)
    const isAuthLoading = useAuthStore((state) => state.isLoading)
    const channelRef = useRef<RealtimeChannel | null>(null)
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const reconnectAttemptRef = useRef(0)
    const subscriptionKeyRef = useRef(0)
    const latestPresenceKeyRef = useRef<string | null>(null)

    const userId = user?.id ?? null
    const userName = user?.name?.trim() ?? ""
    const userAvatarUrl = user?.avatarUrl ?? null

    useEffect(() => {
        if (!calendarId || calendarId === "demo" || isAuthLoading) {
            return
        }

        const supabase = createBrowserSupabase()
        const topic = getCalendarWorkspaceTopic(calendarId)
        const isPrivateChannel = accessMode === "private"
        const presenceId = userId ?? getAnonymousPresenceId()
        const presencePayload: CalendarWorkspacePresencePayload = {
            id: presenceId,
            displayName: userName || getAnonymousPresenceName(presenceId),
            avatarUrl: userAvatarUrl,
            isAnonymous: !userId,
            joinedAt: new Date().toISOString(),
        }
        const presenceKey = JSON.stringify(presencePayload)
        let isDisposed = false
        const subscriptionKey = subscriptionKeyRef.current + 1
        subscriptionKeyRef.current = subscriptionKey

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
            const channel = channelRef.current

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
                .map((member) => ({
                    id: member.id,
                    displayName: member.displayName,
                    avatarUrl: member.avatarUrl,
                    isAnonymous: member.isAnonymous,
                }))

            setWorkspacePresence(nextMembers)
        }

        const clearRetryTimeout = () => {
            if (!retryTimeoutRef.current) {
                return
            }

            clearTimeout(retryTimeoutRef.current)
            retryTimeoutRef.current = null
        }

        const removeChannel = async (targetChannel: RealtimeChannel | null) => {
            if (!targetChannel) {
                return
            }

            if (channelRef.current === targetChannel) {
                channelRef.current = null
            }

            await supabase.removeChannel(targetChannel)
        }

        const scheduleReconnect = (
            status: Exclude<CalendarWorkspaceRealtimeStatus, "SUBSCRIBED">
        ) => {
            if (isDisposed) {
                return
            }

            clearRetryTimeout()

            const attempt = reconnectAttemptRef.current
            const delay =
                CALENDAR_WORKSPACE_REALTIME_RETRY_DELAYS_MS[
                    Math.min(
                        attempt,
                        CALENDAR_WORKSPACE_REALTIME_RETRY_DELAYS_MS.length - 1
                    )
                ]

            reconnectAttemptRef.current = attempt + 1

            retryTimeoutRef.current = setTimeout(() => {
                if (isDisposed) {
                    return
                }

                void subscribeToWorkspace()
            }, delay)

            if (IS_DEV) {
                console.log("[calendar-workspace-realtime:retry]", {
                    topic,
                    status,
                    attempt: attempt + 1,
                    delay,
                })
            }
        }

        const subscribeToWorkspace = async () => {
            clearRetryTimeout()

            await removeChannel(channelRef.current)

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
            } else {
                await supabase.realtime.setAuth()
            }

            if (isDisposed || subscriptionKeyRef.current !== subscriptionKey) {
                return
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

            channelRef.current = nextChannel

            nextChannel
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
                    if (
                        isDisposed ||
                        subscriptionKeyRef.current !== subscriptionKey ||
                        channelRef.current !== nextChannel
                    ) {
                        return
                    }

                    const typedStatus = status as CalendarWorkspaceRealtimeStatus

                    if (IS_DEV) {
                        console.log("[calendar-workspace-realtime]", {
                            topic,
                            status: typedStatus,
                            isPrivateChannel,
                            hasSession: Boolean(session?.access_token),
                        })
                    }

                    if (typedStatus === "SUBSCRIBED") {
                        reconnectAttemptRef.current = 0
                        syncWorkspacePresence()

                        if (latestPresenceKeyRef.current === presenceKey) {
                            return
                        }

                        latestPresenceKeyRef.current = presenceKey
                        await nextChannel.track(presencePayload)
                        return
                    }

                    if (
                        CALENDAR_WORKSPACE_REALTIME_RECOVERABLE_STATUSES.includes(
                            typedStatus
                        )
                    ) {
                        latestPresenceKeyRef.current = null
                        await removeChannel(nextChannel)
                        scheduleReconnect(typedStatus)
                    }
                })
        }

        const {
            data: { subscription: authSubscription },
        } = supabase.auth.onAuthStateChange(
            (_event: AuthChangeEvent, session: Session | null) => {
                void supabase.realtime.setAuth(session?.access_token)

                if (isDisposed || subscriptionKeyRef.current !== subscriptionKey) {
                    return
                }

                if (_event === "TOKEN_REFRESHED" || _event === "INITIAL_SESSION") {
                    return
                }

                latestPresenceKeyRef.current = null
                reconnectAttemptRef.current = 0
                void subscribeToWorkspace()
            }
        )

        void subscribeToWorkspace()

        return () => {
            isDisposed = true
            subscriptionKeyRef.current += 1
            reconnectAttemptRef.current = 0
            latestPresenceKeyRef.current = null
            clearRetryTimeout()
            authSubscription.unsubscribe()
            setWorkspacePresence([])

            void removeChannel(channelRef.current)
        }
    }, [
        calendarId,
        accessMode,
        isAuthLoading,
        removeEventSnapshot,
        setWorkspacePresence,
        upsertEventSnapshot,
        userAvatarUrl,
        userId,
        userName,
    ])
}
