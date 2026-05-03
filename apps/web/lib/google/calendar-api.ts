/**
 * Google Calendar REST API 래퍼
 * - 캘린더 목록 조회
 * - 이벤트 목록 조회 (전체 / 증분 동기화)
 * - Push webhook(watch) 등록 / 해제
 * - 이벤트 생성 / 수정 / 삭제
 */

import {
    GOOGLE_CALENDAR_REQUIRED_SCOPES,
    getMissingGoogleScopes,
    normalizeGoogleScopes,
    refreshAccessToken,
} from "@/lib/google/oauth"
import type { SupabaseClient } from "@supabase/supabase-js"

const CALENDAR_API = "https://www.googleapis.com/calendar/v3"

export class GoogleApiError extends Error {
    status: number
    body: string

    constructor(message: string, status: number, body = "") {
        super(message)
        this.name = "GoogleApiError"
        this.status = status
        this.body = body
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type GoogleCalendarListEntry = {
    id: string
    summary: string
    description?: string
    backgroundColor?: string
    foregroundColor?: string
    primary?: boolean
    accessRole: "freeBusyReader" | "reader" | "writer" | "owner"
    selected?: boolean
    timeZone?: string
}

export type GoogleCalendarEventDateTime = {
    date?: string      // all-day: "2026-05-01"
    dateTime?: string  // timed: "2026-05-01T10:00:00+09:00"
    timeZone?: string
}

export type GoogleCalendarEvent = {
    id: string
    status: "confirmed" | "tentative" | "cancelled"
    summary?: string
    description?: string
    location?: string
    start: GoogleCalendarEventDateTime
    end: GoogleCalendarEventDateTime
    recurrence?: string[]
    recurringEventId?: string
    originalStartTime?: GoogleCalendarEventDateTime
    allDay?: boolean
    created?: string
    updated?: string
    htmlLink?: string
    colorId?: string
    attendees?: Array<{
        email: string
        displayName?: string
        responseStatus?: "needsAction" | "declined" | "tentative" | "accepted"
    }>
}

export type GoogleCalendarEventsResponse = {
    kind: string
    summary: string
    items: GoogleCalendarEvent[]
    nextPageToken?: string
    nextSyncToken?: string
}

export type GoogleWatchResponse = {
    kind: string
    id: string           // 채널 ID
    resourceId: string
    resourceUri: string
    token?: string
    expiration?: string  // milliseconds since epoch as string
}

// ─────────────────────────────────────────────────────────────────────────────
// Token management
// ─────────────────────────────────────────────────────────────────────────────

export type GetTokenResult =
    | { token: string; missingScopes: string[] }
    | null

/**
 * DB에서 액세스 토큰을 가져오고, 만료됐으면 갱신 후 저장.
 * scope 부족 여부는 호출부에서 missingScopes로 판단 — 토큰 자체는 반환한다.
 */
export async function getValidAccessToken(
    supabase: SupabaseClient,
    userId: string,
    googleAccountId: string
): Promise<string | null> {
    const result = await getValidAccessTokenWithScopes(supabase, userId, googleAccountId)
    if (!result) return null
    // 하위 호환: scope 부족이어도 토큰은 반환 (호출부에서 판단)
    return result.token
}

/**
 * 액세스 토큰과 누락 스코프 목록을 함께 반환.
 * scope 부족 여부를 호출부에서 명확히 처리할 때 사용한다.
 */
export async function getValidAccessTokenWithScopes(
    supabase: SupabaseClient,
    userId: string,
    googleAccountId: string,
    requiredScopes: readonly string[] = GOOGLE_CALENDAR_REQUIRED_SCOPES
): Promise<GetTokenResult> {
    const { data } = await supabase
        .from("user_google_integrations")
        .select("access_token, refresh_token, token_expires_at, scopes")
        .eq("user_id", userId)
        .eq("google_account_id", googleAccountId)
        .maybeSingle()

    if (!data) return null

    const normalizedScopes = normalizeGoogleScopes(
        data.scopes as string[] | string | null | undefined
    )
    const missingScopes = normalizedScopes.length > 0
        ? getMissingGoogleScopes(normalizedScopes, requiredScopes)
        : []

    const expiresAt = data.token_expires_at ? new Date(data.token_expires_at).getTime() : 0
    const isExpired = expiresAt < Date.now() + 60_000 // 1분 여유

    if (!isExpired) {
        return { token: data.access_token as string, missingScopes }
    }

    if (!data.refresh_token) return null

    try {
        const refreshed = await refreshAccessToken(data.refresh_token as string)
        const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

        await supabase
            .from("user_google_integrations")
            .update({
                access_token: refreshed.access_token,
                token_expires_at: newExpiry,
            })
            .eq("user_id", userId)
            .eq("google_account_id", googleAccountId)

        return { token: refreshed.access_token, missingScopes }
    } catch {
        return null
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar list
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 유저의 Google 캘린더 목록 조회
 * minAccessRole=writer → 읽기 전용 공유 캘린더 제외
 */
export async function listGoogleCalendars(
    accessToken: string
): Promise<GoogleCalendarListEntry[]> {
    const url = new URL(`${CALENDAR_API}/users/me/calendarList`)
    url.searchParams.set("minAccessRole", "reader")
    url.searchParams.set("maxResults", "250")

    const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
        const body = await res.text()
        throw new GoogleApiError(
            `Failed to list Google calendars: ${res.status}`,
            res.status,
            body
        )
    }

    const data = (await res.json()) as { items?: GoogleCalendarListEntry[] }
    return data.items ?? []
}

// ─────────────────────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────────────────────

type ListEventsOptions = {
    timeMin?: string   // ISO datetime
    timeMax?: string   // ISO datetime
    syncToken?: string // 증분 동기화
    pageToken?: string
    maxResults?: number
}

/**
 * Google 캘린더의 이벤트 목록 조회
 * syncToken 있으면 증분 동기화, 없으면 시간 범위 조회
 */
export async function listGoogleCalendarEvents(
    accessToken: string,
    calendarId: string,
    options: ListEventsOptions = {}
): Promise<GoogleCalendarEventsResponse> {
    const url = new URL(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`)

    if (options.syncToken) {
        url.searchParams.set("syncToken", options.syncToken)
    } else {
        if (options.timeMin) url.searchParams.set("timeMin", options.timeMin)
        if (options.timeMax) url.searchParams.set("timeMax", options.timeMax)
        url.searchParams.set("singleEvents", "true")
        url.searchParams.set("orderBy", "startTime")
    }

    if (options.pageToken) url.searchParams.set("pageToken", options.pageToken)
    url.searchParams.set("maxResults", String(options.maxResults ?? 500))
    // 삭제된 이벤트도 포함 (증분 동기화 시 삭제 감지)
    url.searchParams.set("showDeleted", "true")

    const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (res.status === 410) {
        // syncToken 만료 → 전체 재동기화 필요
        throw new GoogleSyncTokenExpiredError()
    }

    if (!res.ok) {
        throw new Error(`Failed to list Google Calendar events: ${res.status}`)
    }

    return res.json() as Promise<GoogleCalendarEventsResponse>
}

export class GoogleSyncTokenExpiredError extends Error {
    constructor() {
        super("Google Calendar sync token expired, full resync required")
        this.name = "GoogleSyncTokenExpiredError"
    }
}

/**
 * 전체 이벤트 페이지네이션 처리 (다음 syncToken 반환)
 */
export async function fetchAllGoogleCalendarEvents(
    accessToken: string,
    calendarId: string,
    options: Omit<ListEventsOptions, "pageToken">
): Promise<{ events: GoogleCalendarEvent[]; nextSyncToken: string | undefined }> {
    const events: GoogleCalendarEvent[] = []
    let pageToken: string | undefined

    do {
        const res = await listGoogleCalendarEvents(accessToken, calendarId, {
            ...options,
            pageToken,
        })

        events.push(...res.items)
        pageToken = res.nextPageToken

        if (!pageToken) {
            return { events, nextSyncToken: res.nextSyncToken }
        }
    } while (pageToken)

    return { events, nextSyncToken: undefined }
}

export async function getGoogleCalendarEvent(
    accessToken: string,
    calendarId: string,
    eventId: string
): Promise<GoogleCalendarEvent | null> {
    const res = await fetch(
        `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
            headers: { Authorization: `Bearer ${accessToken}` },
        }
    )

    if (res.status === 404 || res.status === 410) {
        return null
    }

    if (!res.ok) {
        const body = await res.text()
        throw new GoogleApiError(
            `Failed to get Google Calendar event: ${res.status}`,
            res.status,
            body
        )
    }

    return res.json() as Promise<GoogleCalendarEvent>
}

// ─────────────────────────────────────────────────────────────────────────────
// Write (이벤트 생성 / 수정 / 삭제)
// ─────────────────────────────────────────────────────────────────────────────

type GoogleEventInput = {
    summary: string
    description?: string
    start: GoogleCalendarEventDateTime
    end: GoogleCalendarEventDateTime
    recurrence?: string[]
}

export async function createGoogleCalendarEvent(
    accessToken: string,
    calendarId: string,
    event: GoogleEventInput
): Promise<GoogleCalendarEvent> {
    const res = await fetch(
        `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(event),
        }
    )

    if (!res.ok) {
        throw new Error(`Failed to create Google Calendar event: ${res.status}`)
    }

    return res.json() as Promise<GoogleCalendarEvent>
}

export async function updateGoogleCalendarEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: Partial<GoogleEventInput>
): Promise<GoogleCalendarEvent> {
    const res = await fetch(
        `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(event),
        }
    )

    if (!res.ok) {
        throw new Error(`Failed to update Google Calendar event: ${res.status}`)
    }

    return res.json() as Promise<GoogleCalendarEvent>
}

export async function deleteGoogleCalendarEvent(
    accessToken: string,
    calendarId: string,
    eventId: string
): Promise<void> {
    const res = await fetch(
        `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
        }
    )

    // 204 No Content = 성공, 410 Gone = 이미 삭제됨 (무시)
    if (!res.ok && res.status !== 410) {
        throw new Error(`Failed to delete Google Calendar event: ${res.status}`)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Push webhook (Watch)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Google Calendar push 알림 채널 등록
 * 이벤트 변경 시 webhookUrl로 POST 요청이 옴
 */
export async function watchGoogleCalendar(
    accessToken: string,
    calendarId: string,
    params: {
        channelId: string
        webhookUrl: string
        /** 채널 만료 시각 (ms). 최대 7일 = now + 7*24*60*60*1000 */
        expirationMs: number
    }
): Promise<GoogleWatchResponse> {
    const res = await fetch(
        `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/watch`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                id: params.channelId,
                type: "web_hook",
                address: params.webhookUrl,
                expiration: String(params.expirationMs),
            }),
        }
    )

    if (!res.ok) {
        const body = await res.text()
        throw new Error(`Failed to register Google Calendar watch: ${res.status} ${body}`)
    }

    return res.json() as Promise<GoogleWatchResponse>
}

/**
 * Google Calendar push 채널 해제
 */
export async function stopGoogleCalendarWatch(
    accessToken: string,
    channelId: string,
    resourceId: string
): Promise<void> {
    const res = await fetch(`${CALENDAR_API}/channels/stop`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: channelId, resourceId }),
    })

    // 204 = 성공, 404 = 이미 없음 (무시)
    if (!res.ok && res.status !== 404) {
        throw new Error(`Failed to stop Google Calendar watch: ${res.status}`)
    }
}
