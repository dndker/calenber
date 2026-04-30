/**
 * GET /api/google-calendar/events
 * 특정 Google 캘린더의 이벤트를 시간 범위로 조회
 * 클라이언트 훅에서 호출 (토큰 갱신은 서버에서 처리)
 */

import { getServerUser } from "@/lib/auth/get-server-user"
import { getValidAccessToken, fetchAllGoogleCalendarEvents, GoogleSyncTokenExpiredError } from "@/lib/google/calendar-api"
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
