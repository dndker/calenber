/**
 * GET    /api/google-calendar/events  — 시간 범위로 이벤트 조회 (클라이언트 훅)
 * POST   /api/google-calendar/events  — 구글 캘린더에 이벤트 생성
 * PATCH  /api/google-calendar/events  — 구글 캘린더 이벤트 수정
 * DELETE /api/google-calendar/events  — 구글 캘린더 이벤트 삭제
 */

import { getServerUser } from "@/lib/auth/get-server-user"
import {
    getValidAccessToken,
    fetchAllGoogleCalendarEvents,
    createGoogleCalendarEvent,
    updateGoogleCalendarEvent,
    deleteGoogleCalendarEvent,
    GoogleSyncTokenExpiredError,
    type GoogleCalendarEventDateTime,
} from "@/lib/google/calendar-api"
import { createServerSupabase } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
    const user = await getServerUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const googleCalendarId = searchParams.get("googleCalendarId")
    const googleAccountId = searchParams.get("googleAccountId")
    const timeMin = searchParams.get("timeMin")
    const timeMax = searchParams.get("timeMax")

    if (!googleCalendarId || !googleAccountId || !timeMin || !timeMax) {
        return NextResponse.json({ error: "Missing required params" }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    const accessToken = await getValidAccessToken(supabase, user.id, googleAccountId)

    if (!accessToken) {
        return NextResponse.json({ error: "Google account not connected" }, { status: 401 })
    }

    try {
        const { events } = await fetchAllGoogleCalendarEvents(
            accessToken,
            googleCalendarId,
            { timeMin, timeMax }
        )

        // cancelled 이벤트 제외 (클라이언트 매퍼에서도 제외하지만 여기서도 처리)
        const visible = events.filter((e) => e.status !== "cancelled")

        return NextResponse.json({ events: visible })
    } catch (err) {
        if (err instanceof GoogleSyncTokenExpiredError) {
            return NextResponse.json({ error: "sync_token_expired" }, { status: 410 })
        }
        console.error("Failed to fetch Google Calendar events:", err)
        return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 })
    }
}

type GoogleCatalogTarget = {
    catalogId: string
    googleCalendarId: string
    googleAccountId: string
}

type CreateGoogleEventBody = {
    /** Calenber 이벤트 ID (webhook 수신 시 중복 방지용으로 DB에 저장) */
    eventId: string
    title: string
    start: string   // ISO datetime
    end: string     // ISO datetime
    allDay: boolean
    timezone: string
    googleCatalogs: GoogleCatalogTarget[]
}

/**
 * POST /api/google-calendar/events
 * 이벤트를 하나 이상의 구글 캘린더에 생성한다.
 * 각 카탈로그마다 토큰을 독립적으로 조회해 멀티계정을 지원한다.
 */
export async function POST(request: Request) {
    const user = await getServerUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as CreateGoogleEventBody
    const { eventId, title, start, end, allDay, timezone, googleCatalogs } = body

    if (!title || !start || !end || !googleCatalogs?.length) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    const results = await Promise.allSettled(
        googleCatalogs.map(async (target) => {
            if (!target.googleCalendarId || !target.googleAccountId) {
                throw new Error(`Invalid catalog config: ${target.catalogId}`)
            }

            const accessToken = await getValidAccessToken(
                supabase,
                user.id,
                target.googleAccountId
            )

            if (!accessToken) {
                throw new Error(
                    `Google account not connected: ${target.googleAccountId}`
                )
            }

            let startDt: GoogleCalendarEventDateTime
            let endDt: GoogleCalendarEventDateTime

            if (allDay) {
                // allDay는 date 형식 (YYYY-MM-DD)
                startDt = { date: start.slice(0, 10) }
                endDt = { date: end.slice(0, 10) }
            } else {
                startDt = { dateTime: start, timeZone: timezone }
                endDt = { dateTime: end, timeZone: timezone }
            }

            const created = await createGoogleCalendarEvent(
                accessToken,
                target.googleCalendarId,
                { summary: title, start: startDt, end: endDt }
            )

            // webhook 수신 시 중복 생성 방지: events 테이블에 google_event_id 저장
            if (eventId && created.id) {
                await supabase
                    .from("events")
                    .update({ google_event_id: created.id })
                    .eq("id", eventId)
            }

            return { catalogId: target.catalogId, googleEventId: created.id }
        })
    )

    const succeeded = results
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<{ catalogId: string; googleEventId: string }>).value)

    const failed = results
        .filter((r) => r.status === "rejected")
        .map((r) => (r as PromiseRejectedResult).reason?.message ?? "unknown error")

    if (succeeded.length === 0) {
        console.error("All Google Calendar event creation failed:", failed)
        return NextResponse.json({ error: "Failed to create events", details: failed }, { status: 500 })
    }

    return NextResponse.json({ succeeded, failed })
}

type UpdateGoogleEventBody = {
    googleCalendarId: string
    googleAccountId: string
    googleEventId: string
    title: string
    start: string
    end: string
    allDay: boolean
    timezone: string
}

/**
 * PATCH /api/google-calendar/events
 * 구글 캘린더 이벤트를 수정한다.
 */
export async function PATCH(request: Request) {
    const user = await getServerUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as UpdateGoogleEventBody
    const { googleCalendarId, googleAccountId, googleEventId, title, start, end, allDay, timezone } = body

    if (!googleCalendarId || !googleAccountId || !googleEventId || !title || !start || !end) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    const accessToken = await getValidAccessToken(supabase, user.id, googleAccountId)

    if (!accessToken) {
        return NextResponse.json({ error: "Google account not connected" }, { status: 401 })
    }

    let startDt: GoogleCalendarEventDateTime
    let endDt: GoogleCalendarEventDateTime

    if (allDay) {
        startDt = { date: start.slice(0, 10) }
        endDt = { date: end.slice(0, 10) }
    } else {
        startDt = { dateTime: start, timeZone: timezone }
        endDt = { dateTime: end, timeZone: timezone }
    }

    try {
        await updateGoogleCalendarEvent(accessToken, googleCalendarId, googleEventId, {
            summary: title,
            start: startDt,
            end: endDt,
        })
        return NextResponse.json({ ok: true })
    } catch (err) {
        console.error("Failed to update Google Calendar event:", err)
        return NextResponse.json({ error: "Failed to update event" }, { status: 500 })
    }
}

type DeleteGoogleEventBody = {
    googleCalendarId: string
    googleAccountId: string
    googleEventId: string
}

/**
 * DELETE /api/google-calendar/events
 * 구글 캘린더 이벤트를 삭제한다.
 */
export async function DELETE(request: Request) {
    const user = await getServerUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as DeleteGoogleEventBody
    const { googleCalendarId, googleAccountId, googleEventId } = body

    if (!googleCalendarId || !googleAccountId || !googleEventId) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    const accessToken = await getValidAccessToken(supabase, user.id, googleAccountId)

    if (!accessToken) {
        return NextResponse.json({ error: "Google account not connected" }, { status: 401 })
    }

    try {
        await deleteGoogleCalendarEvent(accessToken, googleCalendarId, googleEventId)
        return NextResponse.json({ ok: true })
    } catch (err) {
        console.error("Failed to delete Google Calendar event:", err)
        return NextResponse.json({ error: "Failed to delete event" }, { status: 500 })
    }
}
