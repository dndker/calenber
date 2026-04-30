/**
 * POST /api/google-calendar/subscribe
 * 특정 Google 캘린더를 현재 캘린더에 구독으로 등록
 * - calendar_subscription_catalogs 생성 (source_type='google_calendar')
 * - calendar_subscription_installs 생성
 * - Google Watch 채널 등록 (push 알림)
 */

import { getServerUser } from "@/lib/auth/get-server-user"
import {
    getValidAccessToken,
    watchGoogleCalendar,
    fetchAllGoogleCalendarEvents,
    GoogleSyncTokenExpiredError,
} from "@/lib/google/calendar-api"
import { createServerSupabase } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import crypto from "crypto"

export async function POST(request: Request) {
    const user = await getServerUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as {
        calendarId: string        // Calenber 캘린더 ID
        googleAccountId: string
        googleCalendarId: string
        googleCalendarName: string
        collectionColor?: string
    }

    const { calendarId, googleAccountId, googleCalendarId, googleCalendarName, collectionColor } = body

    if (!calendarId || !googleAccountId || !googleCalendarId || !googleCalendarName) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    const accessToken = await getValidAccessToken(supabase, user.id, googleAccountId)

    if (!accessToken) {
        return NextResponse.json({ error: "Google account not connected" }, { status: 401 })
    }

    try {
        // 1. 초기 이벤트 동기화 (최근 1년 범위)
        const timeMin = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
        const timeMax = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

        let syncToken: string | undefined
        try {
            const { nextSyncToken } = await fetchAllGoogleCalendarEvents(
                accessToken,
                googleCalendarId,
                { timeMin, timeMax }
            )
            syncToken = nextSyncToken
        } catch (err) {
            if (!(err instanceof GoogleSyncTokenExpiredError)) throw err
        }
        console.log("[subscribe] step1 syncToken:", syncToken)

        // 2. subscription catalog 생성 (이미 있으면 재사용)
        const { data: existingCatalog } = await supabase
            .from("calendar_subscription_catalogs")
            .select("id")
            .eq("source_type", "google_calendar")
            .eq("owner_user_id", user.id)
            .contains("config", { googleCalendarId, googleAccountId })
            .maybeSingle()
        console.log("[subscribe] step2 existingCatalog:", existingCatalog)

        let catalogId: string

        if (existingCatalog) {
            catalogId = existingCatalog.id as string
            // 이름 + syncToken 갱신
            await supabase
                .from("calendar_subscription_catalogs")
                .update({
                    name: googleCalendarName,
                    ...(syncToken && {
                        config: {
                            provider: "google_calendar_v1",
                            googleCalendarId,
                            googleAccountId,
                            syncToken,
                        },
                    }),
                })
                .eq("id", catalogId)
        } else {
            // slug: 유저별 google calendar 구독을 고유하게 식별
            // googleCalendarId에 @, : 등 특수문자가 포함될 수 있어 해시로 안전하게 처리
            const slugBase = `${user.id}.${googleAccountId}.${googleCalendarId}`
            const slugHash = crypto
                .createHash("sha256")
                .update(slugBase)
                .digest("hex")
                .slice(0, 16)
            const slug = `google.${slugHash}`

            const { data: newCatalog, error: catalogError } = await supabase
                .from("calendar_subscription_catalogs")
                .insert({
                    slug,
                    name: googleCalendarName,
                    description: `Google Calendar: ${googleCalendarName}`,
                    source_type: "google_calendar",
                    verified: false,
                    status: "active",
                    visibility: "private",
                    collection_color: collectionColor ?? "blue",
                    owner_user_id: user.id,
                    created_by: user.id,
                    config: {
                        provider: "google_calendar_v1",
                        googleCalendarId,
                        googleAccountId,
                        syncToken: syncToken ?? null,
                    },
                })
                .select("id")
                .single()
            console.log("[subscribe] step2 insert catalog result:", { newCatalog, catalogError })

            if (catalogError || !newCatalog) {
                throw new Error(`Failed to create catalog: ${catalogError?.message}`)
            }

            catalogId = newCatalog.id as string
        }
        console.log("[subscribe] step2 catalogId:", catalogId)

        // 3. install 생성
        const { error: installError } = await supabase
            .from("calendar_subscription_installs")
            .upsert(
                {
                    calendar_id: calendarId,
                    subscription_catalog_id: catalogId,
                    is_visible: true,
                    created_by: user.id,
                },
                { onConflict: "calendar_id,subscription_catalog_id" }
            )
        console.log("[subscribe] step3 installError:", installError)

        if (installError) {
            throw new Error(`Failed to create install: ${installError.message}`)
        }

        // 4. Google Watch 채널 등록
        const webhookUrl = process.env.GOOGLE_CALENDAR_WEBHOOK_URL
        if (webhookUrl) {
            try {
                const channelId = crypto.randomUUID()
                // 최대 7일 만료
                const expirationMs = Date.now() + 7 * 24 * 60 * 60 * 1000

                const watchRes = await watchGoogleCalendar(accessToken, googleCalendarId, {
                    channelId,
                    webhookUrl,
                    expirationMs,
                })

                await supabase.from("google_calendar_sync_channels").insert({
                    subscription_catalog_id: catalogId,
                    channel_id: watchRes.id,
                    resource_id: watchRes.resourceId,
                    expiration: new Date(Number(watchRes.expiration)).toISOString(),
                    google_calendar_id: googleCalendarId,
                    owner_user_id: user.id,
                })
            } catch (watchErr) {
                // webhook 등록 실패는 치명적이지 않음 — polling으로 fallback
                console.warn("Google watch registration failed (will use polling):", watchErr)
            }
        }

        return NextResponse.json({ catalogId, success: true })
    } catch (err) {
        console.error("Google subscribe error:", err)
        return NextResponse.json({ error: "Failed to subscribe to Google Calendar" }, { status: 500 })
    }
}
