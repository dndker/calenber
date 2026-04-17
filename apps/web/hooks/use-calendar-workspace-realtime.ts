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
    type CalendarWorkspaceCursorBroadcastPayload,
    type CalendarWorkspaceCursor,
    type CalendarWorkspacePresencePayload,
    type CalendarWorkspaceCursorSnapshotRequestPayload,
    type CalendarWorkspaceCursorSnapshotResponsePayload,
    type CalendarWorkspaceRealtimeStatus,
} from "@/lib/calendar/realtime"
import { createBrowserSupabase } from "@/lib/supabase/client"
import dayjs from "@/lib/dayjs"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import { getAnonymousName } from "@/utils/anonymous-name"
import type {
    AuthChangeEvent,
    RealtimeChannel,
    Session,
} from "@supabase/supabase-js"
import { useCallback, useEffect, useRef } from "react"

type CalendarBroadcastMessage = {
    payload?: CalendarEventRealtimePayload
}

type CalendarCursorBroadcastMessage = {
    payload?: CalendarWorkspaceCursorBroadcastPayload
}

type CalendarCursorSnapshotRequestMessage = {
    payload?: CalendarWorkspaceCursorSnapshotRequestPayload
}

type CalendarCursorSnapshotResponseMessage = {
    payload?: CalendarWorkspaceCursorSnapshotResponsePayload
}

const ANONYMOUS_PRESENCE_ID_STORAGE_KEY = "calendar-workspace-anonymous-id"
const IS_DEV = process.env.NODE_ENV === "development"
const SOCKET_RECONNECT_TIMEOUT_THRESHOLD = 2

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

function isCalendarWorkspacePresencePayload(
    value: unknown
): value is CalendarWorkspacePresencePayload {
    if (!value || typeof value !== "object") {
        return false
    }

    const candidate = value as Partial<CalendarWorkspacePresencePayload>

    return (
        typeof candidate.id === "string" &&
        (candidate.userId == null || typeof candidate.userId === "string") &&
        typeof candidate.displayName === "string" &&
        typeof candidate.isAnonymous === "boolean" &&
        typeof candidate.joinedAt === "string" &&
        (candidate.cursor == null ||
            (typeof candidate.cursor === "object" &&
                candidate.cursor !== null &&
                typeof candidate.cursor.date === "string" &&
                (candidate.cursor.type === "cell" ||
                    candidate.cursor.type === "event")))
    )
}

function pickLatestWorkspacePresenceMember(entries: unknown[]) {
    const members = entries.filter(isCalendarWorkspacePresencePayload)

    if (members.length === 0) {
        return null
    }

    return members[members.length - 1] ?? null
}

function isCalendarWorkspaceCursorBroadcastPayload(
    value: unknown
): value is CalendarWorkspaceCursorBroadcastPayload {
    if (!value || typeof value !== "object") {
        return false
    }

    const candidate = value as Partial<CalendarWorkspaceCursorBroadcastPayload>

    return (
        typeof candidate.id === "string" &&
        (candidate.userId == null || typeof candidate.userId === "string") &&
        typeof candidate.occurredAt === "string" &&
        (candidate.cursor === null ||
            (typeof candidate.cursor === "object" &&
                candidate.cursor !== null &&
                typeof candidate.cursor.date === "string" &&
                (candidate.cursor.type === "cell" ||
                    candidate.cursor.type === "event")))
    )
}

function isCalendarWorkspaceCursorSnapshotRequestPayload(
    value: unknown
): value is CalendarWorkspaceCursorSnapshotRequestPayload {
    if (!value || typeof value !== "object") {
        return false
    }

    const candidate = value as Partial<CalendarWorkspaceCursorSnapshotRequestPayload>

    return (
        typeof candidate.requesterId === "string" &&
        typeof candidate.occurredAt === "string"
    )
}

function isCalendarWorkspaceCursorSnapshotResponsePayload(
    value: unknown
): value is CalendarWorkspaceCursorSnapshotResponsePayload {
    if (!value || typeof value !== "object") {
        return false
    }

    const candidate = value as Partial<CalendarWorkspaceCursorSnapshotResponsePayload>

    return (
        typeof candidate.targetId === "string" &&
        typeof candidate.id === "string" &&
        (candidate.userId == null || typeof candidate.userId === "string") &&
        typeof candidate.occurredAt === "string" &&
        (candidate.cursor === null ||
            (typeof candidate.cursor === "object" &&
                candidate.cursor !== null &&
                typeof candidate.cursor.date === "string" &&
                (candidate.cursor.type === "cell" ||
                    candidate.cursor.type === "event")))
    )
}

export function useCalendarWorkspaceRealtime() {
    const activeCalendar = useCalendarStore((state) => state.activeCalendar)
    const calendarId = activeCalendar?.id
    const accessMode = activeCalendar?.accessMode
    const upsertEventSnapshot = useCalendarStore(
        (state) => state.upsertEventSnapshot
    )
    const removeEventSnapshot = useCalendarStore(
        (state) => state.removeEventSnapshot
    )
    const setWorkspacePresence = useCalendarStore(
        (state) => state.setWorkspacePresence
    )
    const setIsWorkspacePresenceLoading = useCalendarStore(
        (state) => state.setIsWorkspacePresenceLoading
    )
    const setWorkspaceCursor = useCalendarStore(
        (state) => state.setWorkspaceCursor
    )
    const workspaceCursor = useCalendarStore((state) => state.workspaceCursor)
    const activeEventId = useCalendarStore((state) => state.activeEventId)
    const selectedDate = useCalendarStore((state) => state.selectedDate)
    const calendarTimezone = useCalendarStore((state) => state.calendarTimezone)
    const activeEvent = useCalendarStore((state) =>
        state.activeEventId
            ? state.events.find((event) => event.id === state.activeEventId)
            : undefined
    )
    const user = useAuthStore((state) => state.user)
    const isAuthLoading = useAuthStore((state) => state.isLoading)
    const channelRef = useRef<RealtimeChannel | null>(null)
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const subscribeAttemptRef = useRef(0)
    const reconnectAttemptRef = useRef(0)
    const timeoutCountRef = useRef(0)
    const subscriptionKeyRef = useRef(0)
    const latestPresenceKeyRef = useRef<string | null>(null)
    const latestCursorBroadcastKeyRef = useRef<string | null>(null)
    const latestCursorSnapshotRequestKeyRef = useRef<string | null>(null)
    const selectedDateRef = useRef(0)
    const calendarTimezoneRef = useRef(calendarTimezone)
    const workspaceCursorRef = useRef<CalendarWorkspaceCursor | null>(null)
    const remoteCursorMapRef = useRef<Map<string, CalendarWorkspaceCursor | null>>(
        new Map()
    )
    const basePresencePayloadRef = useRef<CalendarWorkspacePresencePayload | null>(
        null
    )

    const userId = user?.id ?? null
    const userName = user?.name?.trim() ?? ""
    const userAvatarUrl = user?.avatarUrl ?? null
    const shouldWaitForAuth = accessMode === "private" && isAuthLoading

    useEffect(() => {
        workspaceCursorRef.current = workspaceCursor
    }, [workspaceCursor])

    useEffect(() => {
        selectedDateRef.current = selectedDate
    }, [selectedDate])

    useEffect(() => {
        calendarTimezoneRef.current = calendarTimezone
    }, [calendarTimezone])

    const getCurrentCursor = useCallback((): CalendarWorkspaceCursor | null => {
        if (workspaceCursorRef.current) {
            return workspaceCursorRef.current
        }

        if (selectedDateRef.current <= 0) {
            return null
        }

        return {
            type: "cell",
            date: dayjs
                .tz(selectedDateRef.current, calendarTimezoneRef.current)
                .format("YYYY-MM-DD"),
        }
    }, [])

    useEffect(() => {
        if (!calendarId || calendarId === "demo") {
            return
        }

        if (activeEventId) {
            if (!activeEvent) {
                return
            }

            const nextCursor: CalendarWorkspaceCursor = {
                type: "event",
                eventId: activeEvent.id,
                date: dayjs
                    .tz(activeEvent.start, activeEvent.timezone || calendarTimezone)
                    .format("YYYY-MM-DD"),
            }

            setWorkspaceCursor(nextCursor)
            return
        }

        if (selectedDate <= 0) {
            return
        }

        setWorkspaceCursor({
            type: "cell",
            date: dayjs.tz(selectedDate, calendarTimezone).format("YYYY-MM-DD"),
        })
    }, [
        activeEvent,
        activeEventId,
        calendarId,
        calendarTimezone,
        selectedDate,
        setWorkspaceCursor,
    ])

    const trackPresence = useCallback(async () => {
        const channel = channelRef.current
        const basePresencePayload = basePresencePayloadRef.current

        if (!channel || !basePresencePayload) {
            return
        }

        const nextPresencePayload: CalendarWorkspacePresencePayload = {
            ...basePresencePayload,
            cursor: getCurrentCursor(),
        }

        const nextPresenceKey = JSON.stringify(nextPresencePayload)

        if (latestPresenceKeyRef.current === nextPresenceKey) {
            return
        }

        latestPresenceKeyRef.current = nextPresenceKey
        await channel.track(nextPresencePayload)
    }, [getCurrentCursor])

    const clearLoadingTimeout = useCallback(() => {
        if (!loadingTimeoutRef.current) {
            return
        }

        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
    }, [])

    const setPresenceLoading = useCallback(
        (isLoading: boolean, options?: { immediate?: boolean }) => {
            clearLoadingTimeout()

            if (!isLoading) {
                setIsWorkspacePresenceLoading(false)
                return
            }

            const hasMembers =
                useCalendarStore.getState().workspacePresence.length > 0

            if (options?.immediate || !hasMembers) {
                setIsWorkspacePresenceLoading(true)
                return
            }

            loadingTimeoutRef.current = setTimeout(() => {
                setIsWorkspacePresenceLoading(true)
                loadingTimeoutRef.current = null
            }, 350)
        },
        [clearLoadingTimeout, setIsWorkspacePresenceLoading]
    )

    const broadcastCursor = useCallback(
        async (
            cursor?: CalendarWorkspaceCursor | null,
            options?: { force?: boolean }
        ) => {
            const channel = channelRef.current
            const basePresencePayload = basePresencePayloadRef.current

            if (!channel || !basePresencePayload) {
                return
            }

            const nextPayload: CalendarWorkspaceCursorBroadcastPayload = {
                id: basePresencePayload.id,
                userId: basePresencePayload.userId,
                cursor: cursor ?? null,
                occurredAt: new Date().toISOString(),
            }
            const nextBroadcastKey = JSON.stringify(nextPayload)

            if (
                !options?.force &&
                latestCursorBroadcastKeyRef.current === nextBroadcastKey
            ) {
                return
            }

            latestCursorBroadcastKeyRef.current = nextBroadcastKey
            await channel.send({
                type: "broadcast",
                event: CALENDAR_WORKSPACE_REALTIME_EVENTS.cursorUpdated,
                payload: nextPayload,
            })
        },
        []
    )

    const requestCursorSnapshot = useCallback(
        async (requesterId: string, options?: { force?: boolean }) => {
            const channel = channelRef.current

            if (!channel) {
                return
            }

            const nextPayload: CalendarWorkspaceCursorSnapshotRequestPayload = {
                requesterId,
                occurredAt: new Date().toISOString(),
            }
            const nextRequestKey = JSON.stringify(nextPayload)

            if (
                !options?.force &&
                latestCursorSnapshotRequestKeyRef.current === nextRequestKey
            ) {
                return
            }

            latestCursorSnapshotRequestKeyRef.current = nextRequestKey
            await channel.send({
                type: "broadcast",
                event: CALENDAR_WORKSPACE_REALTIME_EVENTS.cursorSnapshotRequested,
                payload: nextPayload,
            })
        },
        []
    )

    useEffect(() => {
        if (
            !calendarId ||
            calendarId === "demo" ||
            workspaceCursor ||
            selectedDate <= 0
        ) {
            return
        }

        setWorkspaceCursor({
            type: "cell",
            date: dayjs.tz(selectedDate, calendarTimezone).format("YYYY-MM-DD"),
        })
    }, [
        calendarId,
        calendarTimezone,
        selectedDate,
        setWorkspaceCursor,
        workspaceCursor,
    ])

    useEffect(() => {
        if (!calendarId || calendarId === "demo") {
            return
        }

        void broadcastCursor(workspaceCursor)
    }, [broadcastCursor, calendarId, workspaceCursor])

    useEffect(() => {
        if (!calendarId || calendarId === "demo") {
            return
        }

        void trackPresence()
    }, [calendarId, trackPresence, workspaceCursor])

    useEffect(() => {
        if (!calendarId || calendarId === "demo" || shouldWaitForAuth) {
            return
        }

        const supabase = createBrowserSupabase()
        const topic = getCalendarWorkspaceTopic(calendarId)
        const isPrivateChannel = accessMode === "private"
        const presenceId = userId ?? getAnonymousPresenceId()
        const presencePayload: CalendarWorkspacePresencePayload = {
            id: presenceId,
            userId,
            displayName: userName || getAnonymousName(presenceId),
            avatarUrl: userAvatarUrl,
            isAnonymous: !userId,
            joinedAt: new Date().toISOString(),
        }
        let isDisposed = false
        const subscriptionKey = subscriptionKeyRef.current + 1
        subscriptionKeyRef.current = subscriptionKey
        basePresencePayloadRef.current = presencePayload

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

        const handleCursorBroadcast = (message: CalendarCursorBroadcastMessage) => {
            const payload = message.payload

            if (!isCalendarWorkspaceCursorBroadcastPayload(payload)) {
                return
            }

            remoteCursorMapRef.current.set(payload.id, payload.cursor ?? null)

            setWorkspacePresence(
                useCalendarStore.getState().workspacePresence.map((member) =>
                    member.id === payload.id
                        ? {
                              ...member,
                              cursor: payload.cursor ?? undefined,
                          }
                        : member
                )
            )
        }

        const handleCursorSnapshotRequest = (
            message: CalendarCursorSnapshotRequestMessage
        ) => {
            const payload = message.payload

            if (!isCalendarWorkspaceCursorSnapshotRequestPayload(payload)) {
                return
            }

            if (payload.requesterId === presenceId) {
                return
            }

            void channelRef.current?.send({
                type: "broadcast",
                event: CALENDAR_WORKSPACE_REALTIME_EVENTS.cursorSnapshotResponded,
                payload: {
                    targetId: payload.requesterId,
                    id: presenceId,
                    userId,
                    cursor: getCurrentCursor(),
                    occurredAt: new Date().toISOString(),
                } satisfies CalendarWorkspaceCursorSnapshotResponsePayload,
            })
        }

        const handleCursorSnapshotResponse = (
            message: CalendarCursorSnapshotResponseMessage
        ) => {
            const payload = message.payload

            if (!isCalendarWorkspaceCursorSnapshotResponsePayload(payload)) {
                return
            }

            if (payload.targetId !== presenceId) {
                return
            }

            remoteCursorMapRef.current.set(payload.id, payload.cursor ?? null)

            setWorkspacePresence(
                useCalendarStore.getState().workspacePresence.map((member) =>
                    member.id === payload.id
                        ? {
                              ...member,
                              cursor: payload.cursor ?? undefined,
                          }
                        : member
                )
            )
        }

        const handlePresenceJoin = () => {
            syncWorkspacePresence()
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
            const dedupedMembers = Object.values(presenceState)
                .map(pickLatestWorkspacePresenceMember)
                .filter((member): member is CalendarWorkspacePresencePayload =>
                    member !== null
                )
            const existingCursorMap = new Map(
                useCalendarStore
                    .getState()
                    .workspacePresence.map((member) => [
                        member.id,
                        remoteCursorMapRef.current.get(member.id) ??
                            member.cursor ??
                            null,
                    ])
            )
            const nextMembers = Array.from(
                dedupedMembers.reduce(
                    (acc, member) => acc.set(member.id, member),
                    new Map<string, CalendarWorkspacePresencePayload>()
                ).values()
            )
                .sort((a, b) => {
                    if (a.isAnonymous !== b.isAnonymous) {
                        return a.isAnonymous ? 1 : -1
                    }

                    return a.joinedAt.localeCompare(b.joinedAt)
                })
                .map((member) => ({
                    id: member.id,
                    userId: member.userId ?? null,
                    displayName: member.displayName,
                    avatarUrl: member.avatarUrl ?? null,
                    isAnonymous: member.isAnonymous,
                    cursor:
                        member.id === presenceId
                            ? workspaceCursorRef.current ??
                              member.cursor ??
                              undefined
                            : existingCursorMap.get(member.id) ??
                              member.cursor ??
                              undefined,
                }))

            const activeIds = new Set(nextMembers.map((member) => member.id))
            for (const id of remoteCursorMapRef.current.keys()) {
                if (!activeIds.has(id)) {
                    remoteCursorMapRef.current.delete(id)
                }
            }

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

        const removeStaleTopicChannels = async () => {
            const staleChannels = supabase
                .getChannels()
                .filter(
                    (channel: RealtimeChannel) =>
                        channel.topic === `realtime:${topic}`
                )

            await Promise.all(
                staleChannels.map((channel: RealtimeChannel) =>
                    removeChannel(channel)
                )
            )
        }

        const reconnectRealtimeSocket = async () => {
            const realtime = supabase.realtime as {
                disconnect?: () => void | Promise<void>
                connect?: () => void
            }

            try {
                await realtime.disconnect?.()
            } catch (error) {
                if (IS_DEV) {
                    console.warn("[calendar-workspace-realtime:socket-disconnect]", {
                        topic,
                        error,
                    })
                }
            }

            realtime.connect?.()
        }

        const markChannelAsStale = (targetChannel: RealtimeChannel) => {
            if (channelRef.current === targetChannel) {
                channelRef.current = null
            }
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
            const attemptId = subscribeAttemptRef.current + 1
            subscribeAttemptRef.current = attemptId

            clearRetryTimeout()
            setPresenceLoading(true)

            await removeChannel(channelRef.current)
            await removeStaleTopicChannels()

            const {
                data: { session },
            } = await supabase.auth.getSession()

            if (isDisposed || subscribeAttemptRef.current !== attemptId) {
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

            if (
                isDisposed ||
                subscriptionKeyRef.current !== subscriptionKey ||
                subscribeAttemptRef.current !== attemptId
            ) {
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
                .on(
                    "broadcast",
                    {
                        event: CALENDAR_WORKSPACE_REALTIME_EVENTS.cursorUpdated,
                    },
                    handleCursorBroadcast
                )
                .on(
                    "broadcast",
                    {
                        event:
                            CALENDAR_WORKSPACE_REALTIME_EVENTS.cursorSnapshotRequested,
                    },
                    handleCursorSnapshotRequest
                )
                .on(
                    "broadcast",
                    {
                        event:
                            CALENDAR_WORKSPACE_REALTIME_EVENTS.cursorSnapshotResponded,
                    },
                    handleCursorSnapshotResponse
                )
                .on("presence", { event: "sync" }, syncWorkspacePresence)
                .on("presence", { event: "join" }, handlePresenceJoin)
                .on("presence", { event: "leave" }, syncWorkspacePresence)
                .subscribe(async (status: string, err: Error | null) => {
                    if (
                        isDisposed ||
                        subscriptionKeyRef.current !== subscriptionKey ||
                        channelRef.current !== nextChannel ||
                        subscribeAttemptRef.current !== attemptId
                    ) {
                        return
                    }

                    const typedStatus =
                        status as CalendarWorkspaceRealtimeStatus

                    if (IS_DEV) {
                        console.log("[calendar-workspace-realtime]", {
                            topic,
                            status: typedStatus,
                            isPrivateChannel,
                            hasSession: Boolean(session?.access_token),
                            err,
                        })
                    }

                    if (typedStatus === "SUBSCRIBED") {
                        timeoutCountRef.current = 0
                        reconnectAttemptRef.current = 0
                        syncWorkspacePresence()
                        setPresenceLoading(false)
                        await trackPresence()
                        await broadcastCursor(getCurrentCursor(), {
                            force: true,
                        })
                        await requestCursorSnapshot(presenceId, {
                            force: true,
                        })
                        return
                    }

                    if (
                        CALENDAR_WORKSPACE_REALTIME_RECOVERABLE_STATUSES.includes(
                            typedStatus
                        )
                    ) {
                        setPresenceLoading(true)
                        markChannelAsStale(nextChannel)
                        latestPresenceKeyRef.current = null
                        latestCursorBroadcastKeyRef.current = null
                        latestCursorSnapshotRequestKeyRef.current = null

                        if (typedStatus === "TIMED_OUT") {
                            timeoutCountRef.current += 1

                            if (
                                timeoutCountRef.current >=
                                SOCKET_RECONNECT_TIMEOUT_THRESHOLD
                            ) {
                                timeoutCountRef.current = 0
                                await reconnectRealtimeSocket()
                            }
                        } else {
                            timeoutCountRef.current = 0
                        }

                        scheduleReconnect(typedStatus)
                    }
                })
        }

        const {
            data: { subscription: authSubscription },
        } = supabase.auth.onAuthStateChange(
            (_event: AuthChangeEvent, session: Session | null) => {
                void supabase.realtime.setAuth(session?.access_token)

                if (
                    isDisposed ||
                    subscriptionKeyRef.current !== subscriptionKey
                ) {
                    return
                }

                if (
                    _event === "TOKEN_REFRESHED" ||
                    _event === "INITIAL_SESSION"
                ) {
                    return
                }

                timeoutCountRef.current = 0
                latestPresenceKeyRef.current = null
                latestCursorBroadcastKeyRef.current = null
                latestCursorSnapshotRequestKeyRef.current = null
                reconnectAttemptRef.current = 0
                void subscribeToWorkspace()
            }
        )

        void subscribeToWorkspace()

        const remoteCursorMap = remoteCursorMapRef.current

        return () => {
            isDisposed = true
            subscriptionKeyRef.current += 1
            subscribeAttemptRef.current += 1
            reconnectAttemptRef.current = 0
            timeoutCountRef.current = 0
            latestPresenceKeyRef.current = null
            latestCursorBroadcastKeyRef.current = null
            latestCursorSnapshotRequestKeyRef.current = null
            basePresencePayloadRef.current = null
            remoteCursorMap.clear()
            clearRetryTimeout()
            clearLoadingTimeout()
            authSubscription.unsubscribe()
            setPresenceLoading(false)

            void removeChannel(channelRef.current)
        }
    }, [
        calendarId,
        accessMode,
        shouldWaitForAuth,
        removeEventSnapshot,
        setIsWorkspacePresenceLoading,
        setWorkspacePresence,
        broadcastCursor,
        getCurrentCursor,
        requestCursorSnapshot,
        trackPresence,
        upsertEventSnapshot,
        userAvatarUrl,
        userId,
        userName,
        clearLoadingTimeout,
        setPresenceLoading,
    ])

    useEffect(() => {
        if (calendarId && calendarId !== "demo") {
            return
        }

        clearLoadingTimeout()
        setIsWorkspacePresenceLoading(false)
        setWorkspacePresence([])
    }, [calendarId, clearLoadingTimeout, setIsWorkspacePresenceLoading, setWorkspacePresence])
}
