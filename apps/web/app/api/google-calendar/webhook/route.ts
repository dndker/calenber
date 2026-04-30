/**
 * POST /api/google-calendar/webhook
 * Google Calendar push 알림 수신 엔드포인트.
 *
 * Google이 이벤트 변경 시 헤더로 다음을 전송:
 *   X-Goog-Channel-ID: <channelId>
 *   X-Goog-Resource-ID: <resourceId>
 *   X-Goog-Resource-State: sync | exists | not_exists
 *   X-Goog-Channel-Token: (optional)
 *
 * 처리 흐름:
 *   1. 채널 ID로 google_calendar_sync_channels 조회 → catalogId, googleCalendarId 파악
 *   2. Google API로 증분 이벤트 조회 (syncToken 사용)
 *   3. Supabase Realtime broadcast → 클라이언트에서 re-fetch
 */

import {
    fetchAllGoogleCalendarEvents,
    getValidAccessToken,
    GoogleSyncTokenExpiredError,
} from "@/lib/google/calendar-api"
import { getSubscriptionCatalogTopic } from "@/lib/calendar/realtime"
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

function createServiceSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
    if (!key) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set")
    }
    return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(request: Request) {
    const channelId = request.headers.get("x-goog-channel-id")
    const resourceState = request.headers.get("x-goog-resource-state")

    // sync 이벤트는 채널 등록 확인용 — 처리 불필요
    if (resourceState === "sync") {
        return new NextResponse(null, { status: 200 })
    }

    if (!channelId) {
        return new NextResponse(null, { status: 400 })
    }

    try {
        const supabase = createServiceSupabase()

        // 채널 정보 조회
        const { data: channel } = await supabase
            .from("google_calendar_sync_channels")
            .select("subscription_catalog_id, google_calendar_id, owner_user_id")
            .eq("channel_id", channelId)
            .maybeSingle()

        if (!channel) {
            // 알 수 없는 채널 — 무시
            return new NextResponse(null, { status: 200 })
        }

        const { subscription_catalog_id, google_calendar_id, owner_user_id } = channel as {
            subscription_catalog_id: string
            google_calendar_id: string
            owner_user_id: string
        }

        // 카탈로그에서 syncToken과 googleAccountId 조회
        const { data: catalog } = await supabase
            .from("calendar_subscription_catalogs")
            .select("config")
            .eq("id", subscription_catalog_id)
            .maybeSingle()

        if (!catalog) {
            return new NextResponse(null, { status: 200 })
        }

        const config = catalog.config as {
            googleAccountId: string
            syncToken?: string
        }

        const accessToken = await getValidAccessToken(supabase, owner_user_id, config.googleAccountId)
        if (!accessToken) {
            return new NextResponse(null, { status: 200 })
        }

        // 증분 동기화
        try {
            const { nextSyncToken } = await fetchAllGoogleCalendarEvents(
                accessToken,
                google_calendar_id,
                { syncToken: config.syncToken }
            )

            // syncToken 갱신
            if (nextSyncToken) {
                await supabase
                    .from("calendar_subscription_catalogs")
                    .update({
                        config: { ...config, syncToken: nextSyncToken },
                    })
                    .eq("id", subscription_catalog_id)
            }
        } catch (err) {
            if (err instanceof GoogleSyncTokenExpiredError) {
                // syncToken 만료 → 전체 재동기화 플래그 설정
                await supabase
                    .from("calendar_subscription_catalogs")
                    .update({
                        config: { ...config, syncToken: null, needsFullSync: true },
                    })
                    .eq("id", subscription_catalog_id)
            } else {
                throw err
            }
        }

        // Supabase Realtime broadcast → 클라이언트에서 re-fetch 트리거
        const topic = getSubscriptionCatalogTopic(subscription_catalog_id)
        await supabase.channel(topic).send({
            type: "broadcast",
            event: "google.calendar.events.changed",
            payload: {
                entity: "google_calendar_events",
                catalogId: subscription_catalog_id,
                occurredAt: new Date().toISOString(),
            },
        })

        return new NextResponse(null, { status: 200 })
    } catch (err) {
        console.error("Google Calendar webhook error:", err)
        // Google에 200 반환 — 에러 시 재시도 방지
        return new NextResponse(null, { status: 200 })
    }
}
