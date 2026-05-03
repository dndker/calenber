/**
 * GET /api/google-calendar/list?accountId=<googleAccountId>
 * 연결된 Google 계정의 캘린더 목록 반환
 */

import { getServerUser } from "@/lib/auth/get-server-user"
import {
    GoogleApiError,
    getValidAccessToken,
    listGoogleCalendars,
} from "@/lib/google/calendar-api"
import { createServerSupabase } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
    const user = await getServerUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get("accountId")

    if (!accountId) {
        return NextResponse.json({ error: "accountId required" }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    const accessToken = await getValidAccessToken(supabase, user.id, accountId)

    if (!accessToken) {
        return NextResponse.json({ error: "Google account not connected or token expired" }, { status: 401 })
    }

    try {
        const calendars = await listGoogleCalendars(accessToken)
        return NextResponse.json({ calendars })
    } catch (err) {
        if (err instanceof GoogleApiError) {
            if (err.status === 401) {
                return NextResponse.json(
                    {
                        error: "google_unauthorized",
                        message: "Google 인증이 만료되었습니다. 계정을 다시 연결해 주세요.",
                    },
                    { status: 401 }
                )
            }
            if (err.status === 403) {
                return NextResponse.json(
                    {
                        error: "google_insufficient_scope",
                        message:
                            "Google Calendar 권한이 부족합니다. 계정을 다시 연결하고 모든 권한에 동의해 주세요.",
                    },
                    { status: 403 }
                )
            }
            console.error("Failed to list Google calendars (Google API):", {
                status: err.status,
                body: err.body,
            })
            return NextResponse.json(
                { error: "google_api_error", status: err.status },
                { status: 502 }
            )
        }

        console.error("Failed to list Google calendars:", err)
        return NextResponse.json({ error: "Failed to fetch Google calendars" }, { status: 500 })
    }
}
