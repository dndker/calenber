"use client"

import { normalizeCalendarCategoryColor } from "@/lib/calendar/category-color"
import {
    mapCalendarEventRecordToCalendarEvent,
    type CalendarEventRecord,
} from "@/lib/calendar/event-record"
import { normalizeCalendarEventFieldSettings } from "@/lib/calendar/event-field-settings"
import { normalizeCalendarLayoutOptions } from "@/lib/calendar/layout-options"
import {
    CALENDAR_WORKSPACE_REALTIME_EVENTS,
    CALENDAR_WORKSPACE_REALTIME_RECOVERABLE_STATUSES,
    CALENDAR_WORKSPACE_REALTIME_RETRY_DELAYS_MS,
    getCalendarWorkspaceTopic,
    type CalendarEventCategoryRealtimePayload,
    type CalendarEventRealtimePayload,
    type CalendarSettingsRealtimePayload,
    type CalendarWorkspaceCursor,
    type CalendarWorkspaceCursorBroadcastPayload,
    type CalendarWorkspaceCursorSnapshotRequestPayload,
    type CalendarWorkspaceCursorSnapshotResponsePayload,
    type CalendarWorkspacePresencePayload,
    type CalendarWorkspaceRealtimeStatus,
} from "@/lib/calendar/realtime"
import dayjs from "@/lib/dayjs"
import { createBrowserSupabase } from "@/lib/supabase/client"
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

type CalendarCategoryBroadcastMessage = {
    payload?: CalendarEventCategoryRealtimePayload
}

type CalendarSettingsBroadcastMessage = {
    payload?: CalendarSettingsRealtimePayload
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
const SOCKET_RECONNECT_TIMEOUT_THRESHOLD = 2
const PRESENCE_HEARTBEAT_INTERVAL_MS = 20_000
const PRESENCE_SYNC_INTERVAL_MS = 10_000
const PRESENCE_STALE_TIMEOUT_MS = 90_000
const PRESENCE_TRANSIENT_GRACE_MS = 4_000
const PROJECT_DB_UNAVAILABLE_ERROR_CODES = [
    "UnableToConnectToProject",
    "UnableToConnectToTenantDatabase",
    "DatabaseConnectionIssue",
    "DatabaseLackOfConnections",
    "ConnectionInitializing",
] as const

function getRealtimeErrorMessage(error: Error | null) {
    if (!error) {
        return null
    }

    return typeof error.message === "string" ? error.message : String(error)
}

function isProjectDatabaseUnavailableError(error: Error | null) {
    const message = getRealtimeErrorMessage(error)?.toLowerCase()

    if (!message) {
        return false
    }

    return PROJECT_DB_UNAVAILABLE_ERROR_CODES.some((code) =>
        message.includes(code.toLowerCase())
    )
}

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
        (candidate.lastSeenAt == null ||
            typeof candidate.lastSeenAt === "string") &&
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

function getPresenceLastSeenTime(member: CalendarWorkspacePresencePayload) {
    const time = new Date(member.lastSeenAt ?? member.joinedAt).valueOf()

    return Number.isFinite(time) ? time : null
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

function isCalendarEventCategoryRealtimePayload(
    value: unknown
): value is CalendarEventCategoryRealtimePayload {
    if (!value || typeof value !== "object") {
        return false
    }

    const candidate = value as Partial<CalendarEventCategoryRealtimePayload>

    return (
        candidate.entity === "event_category" &&
        typeof candidate.calendarId === "string" &&
        typeof candidate.categoryId === "string" &&
        typeof candidate.occurredAt === "string"
    )
}

function isCalendarSettingsRealtimePayload(
    value: unknown
): value is CalendarSettingsRealtimePayload {
    if (!value || typeof value !== "object") {
        return false
    }

    const candidate = value as Partial<CalendarSettingsRealtimePayload>

    return (
        candidate.entity === "calendar_settings" &&
        candidate.operation === "update" &&
        typeof candidate.calendarId === "string" &&
        typeof candidate.occurredAt === "string"
    )
}

function isCalendarWorkspaceCursorSnapshotRequestPayload(
    value: unknown
): value is CalendarWorkspaceCursorSnapshotRequestPayload {
    if (!value || typeof value !== "object") {
        return false
    }

    const candidate =
        value as Partial<CalendarWorkspaceCursorSnapshotRequestPayload>

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

    const candidate =
        value as Partial<CalendarWorkspaceCursorSnapshotResponsePayload>

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
    const upsertEventCategorySnapshot = useCalendarStore(
        (state) => state.upsertEventCategorySnapshot
    )
    const removeEventCategorySnapshot = useCalendarStore(
        (state) => state.removeEventCategorySnapshot
    )
    const updateCalendarSnapshot = useCalendarStore(
        (state) => state.updateCalendarSnapshot
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
    const setEventLayout = useCalendarStore((state) => state.setEventLayout)
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
    const subscribeAttemptRef = useRef(0)
    const reconnectAttemptRef = useRef(0)
    const timeoutCountRef = useRef(0)
    const subscriptionKeyRef = useRef(0)
    const isSubscribingRef = useRef(false)
    const subscribingStartedAtRef = useRef<number | null>(null)
    const latestPresenceKeyRef = useRef<string | null>(null)
    const latestCursorBroadcastKeyRef = useRef<string | null>(null)
    const latestCursorSnapshotRequestKeyRef = useRef<string | null>(null)
    const selectedDateRef = useRef(0)
    const calendarTimezoneRef = useRef(calendarTimezone)
    const workspaceCursorRef = useRef<CalendarWorkspaceCursor | null>(null)
    const remoteCursorMapRef = useRef<
        Map<string, CalendarWorkspaceCursor | null>
    >(new Map())
    const basePresencePayloadRef =
        useRef<CalendarWorkspacePresencePayload | null>(null)

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
                    .tz(
                        activeEvent.start,
                        activeEvent.timezone || calendarTimezone
                    )
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

    const trackPresence = useCallback(
        async (options?: { force?: boolean }) => {
            const channel = channelRef.current
            const basePresencePayload = basePresencePayloadRef.current

            if (!channel || !basePresencePayload) {
                return false
            }

            const nextPresenceSnapshot: CalendarWorkspacePresencePayload = {
                ...basePresencePayload,
                cursor: getCurrentCursor(),
            }

            const nextPresenceKey = JSON.stringify(nextPresenceSnapshot)

            if (
                !options?.force &&
                latestPresenceKeyRef.current === nextPresenceKey
            ) {
                return true
            }

            try {
                const trackResult = await channel.track({
                    ...nextPresenceSnapshot,
                    lastSeenAt: new Date().toISOString(),
                })

                if (trackResult !== "ok") {
                    latestPresenceKeyRef.current = null
                    return false
                }

                latestPresenceKeyRef.current = nextPresenceKey
                return true
            } catch {
                latestPresenceKeyRef.current = null
                return false
            }
        },
        [getCurrentCursor]
    )

    const setPresenceLoading = useCallback(
        (isLoading: boolean, options?: { immediate?: boolean }) => {
            if (!isLoading) {
                setIsWorkspacePresenceLoading(false)
                return
            }

            const hasMembers =
                useCalendarStore.getState().workspacePresence.length > 0

            if (options?.immediate || !hasMembers) {
                setIsWorkspacePresenceLoading(true)
            }
        },
        [setIsWorkspacePresenceLoading]
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
        const joinedAt = new Date().toISOString()
        const presencePayload: CalendarWorkspacePresencePayload = {
            id: presenceId,
            userId,
            displayName: userName || getAnonymousName(presenceId),
            avatarUrl: userAvatarUrl,
            isAnonymous: !userId,
            joinedAt,
            lastSeenAt: joinedAt,
        }
        let isDisposed = false
        let isRecoveringPresence = false
        let presenceHeartbeatInterval: ReturnType<typeof setInterval> | null =
            null
        let presenceSyncInterval: ReturnType<typeof setInterval> | null = null
        const subscriptionKey = subscriptionKeyRef.current + 1
        subscriptionKeyRef.current = subscriptionKey
        basePresencePayloadRef.current = presencePayload

        const resetRealtimeDedupState = () => {
            latestPresenceKeyRef.current = null
            latestCursorBroadcastKeyRef.current = null
            latestCursorSnapshotRequestKeyRef.current = null
        }

        const applyRemoteCursor = (
            memberId: string,
            cursor: CalendarWorkspaceCursor | null
        ) => {
            remoteCursorMapRef.current.set(memberId, cursor)

            setWorkspacePresence(
                useCalendarStore.getState().workspacePresence.map((member) =>
                    member.id === memberId
                        ? {
                              ...member,
                              cursor: cursor ?? undefined,
                          }
                        : member
                )
            )
        }

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

        const handleCategoryBroadcast = (
            message: CalendarCategoryBroadcastMessage
        ) => {
            const payload = message.payload

            if (!isCalendarEventCategoryRealtimePayload(payload)) {
                return
            }

            if (payload.operation === "delete") {
                removeEventCategorySnapshot(payload.categoryId)
                return
            }

            if (!payload.record) {
                return
            }

            upsertEventCategorySnapshot({
                id: payload.record.id,
                calendarId: payload.record.calendar_id,
                name: payload.record.name,
                options: {
                    visibleByDefault:
                        payload.record.options?.visibleByDefault !== false,
                    color: normalizeCalendarCategoryColor(
                        payload.record.options?.color
                    ),
                },
                createdById: payload.record.created_by,
                createdAt: new Date(payload.record.created_at).valueOf(),
                updatedAt: new Date(payload.record.updated_at).valueOf(),
            })
        }

        const handleCalendarSettingsBroadcast = (
            message: CalendarSettingsBroadcastMessage
        ) => {
            const payload = message.payload

            if (
                !isCalendarSettingsRealtimePayload(payload) ||
                !payload.record
            ) {
                return
            }

            updateCalendarSnapshot(payload.record.id, {
                name: payload.record.name,
                avatarUrl: payload.record.avatar_url,
                accessMode: payload.record.access_mode,
                eventLayout: payload.record.event_layout,
                eventFieldSettings: normalizeCalendarEventFieldSettings(
                    payload.record.event_field_settings
                ),
                layoutOptions: normalizeCalendarLayoutOptions(
                    payload.record.layout_options
                ),
            })
            if (
                payload.record.id ===
                useCalendarStore.getState().activeCalendar?.id
            ) {
                setEventLayout(payload.record.event_layout)
            }
        }

        const handleCursorBroadcast = (
            message: CalendarCursorBroadcastMessage
        ) => {
            const payload = message.payload

            if (!isCalendarWorkspaceCursorBroadcastPayload(payload)) {
                return
            }

            applyRemoteCursor(payload.id, payload.cursor ?? null)
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

            applyRemoteCursor(payload.id, payload.cursor ?? null)
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
            const now = Date.now()
            const dedupedMembers = Object.values(presenceState)
                .map(pickLatestWorkspacePresenceMember)
                .filter(
                    (member): member is CalendarWorkspacePresencePayload =>
                        member !== null
                )
                .filter((member) => {
                    if (member.id === presenceId) {
                        return true
                    }

                    const lastSeenTime = getPresenceLastSeenTime(member)

                    return (
                        lastSeenTime === null ||
                        now - lastSeenTime <= PRESENCE_STALE_TIMEOUT_MS
                    )
                })
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
                dedupedMembers
                    .reduce(
                        (acc, member) => acc.set(member.id, member),
                        new Map<string, CalendarWorkspacePresencePayload>()
                    )
                    .values()
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
                            ? (workspaceCursorRef.current ??
                              member.cursor ??
                              undefined)
                            : (existingCursorMap.get(member.id) ??
                              member.cursor ??
                              undefined),
                }))

            const activeIds = new Set(nextMembers.map((member) => member.id))
            for (const id of remoteCursorMapRef.current.keys()) {
                if (!activeIds.has(id)) {
                    remoteCursorMapRef.current.delete(id)
                }
            }

            const {
                workspacePresence: currentMembers,
                isWorkspacePresenceLoading: isPresenceLoading,
            } = useCalendarStore.getState()
            const isWithinSubscribeGrace =
                subscribingStartedAtRef.current !== null &&
                Date.now() - subscribingStartedAtRef.current <
                    PRESENCE_TRANSIENT_GRACE_MS

            const hasNextSelf = nextMembers.some(
                (member) => member.id === presenceId
            )

            // 탭 복귀 직후 self presence가 아직 track되지 않은 순간에는
            // 기존/기본 self 항목을 유지해 "내가 사라지는" 깜빡임을 막는다.
            if (
                !hasNextSelf &&
                (isSubscribingRef.current || isPresenceLoading) &&
                isWithinSubscribeGrace
            ) {
                const currentSelf =
                    currentMembers.find((member) => member.id === presenceId) ??
                    basePresencePayloadRef.current

                if (currentSelf) {
                    nextMembers.unshift({
                        id: currentSelf.id,
                        userId: currentSelf.userId,
                        displayName: currentSelf.displayName,
                        avatarUrl: currentSelf.avatarUrl,
                        isAnonymous: currentSelf.isAnonymous,
                        cursor: currentSelf.cursor ?? undefined,
                    })
                }
            }

            // Re-subscribe 중에는 presenceState가 잠시 비는 경우가 있어,
            // 이미 그려진 멤버를 빈 배열로 즉시 덮어쓰지 않는다.
            // 단, 연결이 안정화된 이후에는 빈 배열도 정상 반영해서 유령 멤버를 제거한다.
            if (
                nextMembers.length === 0 &&
                currentMembers.length > 0 &&
                (isSubscribingRef.current || isPresenceLoading) &&
                isWithinSubscribeGrace
            ) {
                return
            }

            setWorkspacePresence(nextMembers)

            if (
                isPresenceLoading &&
                (nextMembers.length > 0 || !isWithinSubscribeGrace)
            ) {
                setPresenceLoading(false)
            }
        }

        const clearRetryTimeout = () => {
            if (!retryTimeoutRef.current) {
                return
            }

            clearTimeout(retryTimeoutRef.current)
            retryTimeoutRef.current = null
        }

        const clearPresenceIntervals = () => {
            if (presenceHeartbeatInterval) {
                clearInterval(presenceHeartbeatInterval)
                presenceHeartbeatInterval = null
            }

            if (presenceSyncInterval) {
                clearInterval(presenceSyncInterval)
                presenceSyncInterval = null
            }
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

        const reconnectRealtimeSocket = async () => {
            const realtime = supabase.realtime as {
                disconnect?: () => void | Promise<void>
                connect?: () => void
            }

            try {
                await realtime.disconnect?.()
            } catch {
                // Ignore disconnect failures and let the next connect attempt recover.
            }

            realtime.connect?.()
        }

        const scheduleReconnect = (
            status: Exclude<CalendarWorkspaceRealtimeStatus, "SUBSCRIBED">,
            options?: { error?: Error | null; preferSlowerBackoff?: boolean }
        ) => {
            if (isDisposed) {
                return
            }

            clearRetryTimeout()

            const attempt = reconnectAttemptRef.current
            const baseDelay =
                CALENDAR_WORKSPACE_REALTIME_RETRY_DELAYS_MS[
                    Math.min(
                        attempt,
                        CALENDAR_WORKSPACE_REALTIME_RETRY_DELAYS_MS.length - 1
                    )
                ]
            const delay = options?.preferSlowerBackoff
                ? Math.max(baseDelay!, 15_000)
                : baseDelay

            reconnectAttemptRef.current = attempt + 1

            retryTimeoutRef.current = setTimeout(() => {
                if (isDisposed) {
                    return
                }

                void subscribeToWorkspace()
            }, delay)
        }

        const subscribeToWorkspace = async () => {
            const attemptId = subscribeAttemptRef.current + 1
            subscribeAttemptRef.current = attemptId
            isSubscribingRef.current = true
            subscribingStartedAtRef.current = Date.now()

            clearRetryTimeout()
            resetRealtimeDedupState()
            setPresenceLoading(true)

            await removeChannel(channelRef.current)

            const {
                data: { session },
            } = await supabase.auth.getSession()

            if (isDisposed || subscribeAttemptRef.current !== attemptId) {
                if (subscribeAttemptRef.current === attemptId) {
                    isSubscribingRef.current = false
                    subscribingStartedAtRef.current = null
                }
                return
            }

            if (isPrivateChannel && !session?.access_token) {
                isSubscribingRef.current = false
                subscribingStartedAtRef.current = null
                scheduleReconnect("TIMED_OUT")
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
                if (subscribeAttemptRef.current === attemptId) {
                    isSubscribingRef.current = false
                    subscribingStartedAtRef.current = null
                }
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
                        event: CALENDAR_WORKSPACE_REALTIME_EVENTS.categoryCreated,
                    },
                    handleCategoryBroadcast
                )
                .on(
                    "broadcast",
                    {
                        event: CALENDAR_WORKSPACE_REALTIME_EVENTS.categoryUpdated,
                    },
                    handleCategoryBroadcast
                )
                .on(
                    "broadcast",
                    {
                        event: CALENDAR_WORKSPACE_REALTIME_EVENTS.categoryDeleted,
                    },
                    handleCategoryBroadcast
                )
                .on(
                    "broadcast",
                    {
                        event: CALENDAR_WORKSPACE_REALTIME_EVENTS.settingsUpdated,
                    },
                    handleCalendarSettingsBroadcast
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
                        event: CALENDAR_WORKSPACE_REALTIME_EVENTS.cursorSnapshotRequested,
                    },
                    handleCursorSnapshotRequest
                )
                .on(
                    "broadcast",
                    {
                        event: CALENDAR_WORKSPACE_REALTIME_EVENTS.cursorSnapshotResponded,
                    },
                    handleCursorSnapshotResponse
                )
                .on("presence", { event: "sync" }, syncWorkspacePresence)
                .on("presence", { event: "join" }, syncWorkspacePresence)
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

                    if (typedStatus === "SUBSCRIBED") {
                        isSubscribingRef.current = false
                        subscribingStartedAtRef.current = null
                        timeoutCountRef.current = 0
                        reconnectAttemptRef.current = 0
                        const didTrackPresence = await trackPresence({
                            force: true,
                        })

                        if (!didTrackPresence) {
                            setPresenceLoading(true)
                            scheduleReconnect("CHANNEL_ERROR")
                            return
                        }

                        syncWorkspacePresence()
                        setPresenceLoading(false)
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
                        isSubscribingRef.current = false
                        subscribingStartedAtRef.current = null
                        const isProjectDbUnavailable =
                            isProjectDatabaseUnavailableError(err)

                        setPresenceLoading(true)
                        if (channelRef.current === nextChannel) {
                            channelRef.current = null
                        }
                        resetRealtimeDedupState()

                        if (isProjectDbUnavailable) {
                            timeoutCountRef.current = 0
                        } else if (typedStatus === "TIMED_OUT") {
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

                        scheduleReconnect(typedStatus, {
                            error: err,
                            preferSlowerBackoff: isProjectDbUnavailable,
                        })
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
                resetRealtimeDedupState()
                reconnectAttemptRef.current = 0
                void subscribeToWorkspace()
            }
        )

        setPresenceLoading(true)
        void subscribeToWorkspace()

        presenceHeartbeatInterval = setInterval(() => {
            if (isDisposed || isSubscribingRef.current || !channelRef.current) {
                return
            }

            void trackPresence({ force: true }).then((didTrackPresence) => {
                if (didTrackPresence) {
                    syncWorkspacePresence()
                }
            })
        }, PRESENCE_HEARTBEAT_INTERVAL_MS)

        presenceSyncInterval = setInterval(() => {
            if (isDisposed) {
                return
            }

            syncWorkspacePresence()
        }, PRESENCE_SYNC_INTERVAL_MS)

        const recoverVisiblePresence = async () => {
            if (isDisposed || isRecoveringPresence) {
                return
            }

            isRecoveringPresence = true

            try {
                if (!channelRef.current && !isSubscribingRef.current) {
                    reconnectAttemptRef.current = 0
                    timeoutCountRef.current = 0
                    resetRealtimeDedupState()
                    void subscribeToWorkspace()
                    return
                }

                if (!channelRef.current) {
                    return
                }

                setPresenceLoading(true)
                const didTrackPresence = await trackPresence({ force: true })

                if (isDisposed) {
                    return
                }

                if (!didTrackPresence) {
                    reconnectAttemptRef.current = 0
                    timeoutCountRef.current = 0
                    resetRealtimeDedupState()
                    void subscribeToWorkspace()
                    return
                }

                syncWorkspacePresence()
                setPresenceLoading(false)
                await broadcastCursor(getCurrentCursor(), { force: true })
                await requestCursorSnapshot(presenceId, { force: true })
            } finally {
                isRecoveringPresence = false
            }
        }

        const handleVisibilityOrFocus = () => {
            if (isDisposed) {
                return
            }

            if (typeof document !== "undefined" && document.hidden) {
                return
            }

            void recoverVisiblePresence()
        }

        const handlePageHide = () => {
            if (isDisposed) {
                return
            }

            void channelRef.current?.untrack()
        }

        if (typeof document !== "undefined") {
            document.addEventListener(
                "visibilitychange",
                handleVisibilityOrFocus
            )
        }
        if (typeof window !== "undefined") {
            window.addEventListener("focus", handleVisibilityOrFocus)
            window.addEventListener("pagehide", handlePageHide)
        }

        const remoteCursorMap = remoteCursorMapRef.current

        return () => {
            isDisposed = true
            subscriptionKeyRef.current += 1
            subscribeAttemptRef.current += 1
            reconnectAttemptRef.current = 0
            timeoutCountRef.current = 0
            isSubscribingRef.current = false
            subscribingStartedAtRef.current = null
            resetRealtimeDedupState()
            basePresencePayloadRef.current = null
            remoteCursorMap.clear()
            clearRetryTimeout()
            clearPresenceIntervals()
            authSubscription.unsubscribe()
            setPresenceLoading(false)
            if (typeof document !== "undefined") {
                document.removeEventListener(
                    "visibilitychange",
                    handleVisibilityOrFocus
                )
            }
            if (typeof window !== "undefined") {
                window.removeEventListener("focus", handleVisibilityOrFocus)
                window.removeEventListener("pagehide", handlePageHide)
            }

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
        removeEventCategorySnapshot,
        updateCalendarSnapshot,
        upsertEventSnapshot,
        upsertEventCategorySnapshot,
        userAvatarUrl,
        userId,
        userName,
        setPresenceLoading,
        setEventLayout,
    ])

    useEffect(() => {
        if (calendarId !== "demo") {
            return
        }

        setIsWorkspacePresenceLoading(false)
        setWorkspacePresence([])
    }, [calendarId, setIsWorkspacePresenceLoading, setWorkspacePresence])
}
