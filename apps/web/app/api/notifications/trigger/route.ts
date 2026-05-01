import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
import type { TriggerNotificationPayload } from "@/lib/notification/mutations"

/**
 * POST /api/notifications/trigger
 *
 * 알림을 생성한다. 요청자는 반드시 인증된 유저여야 한다.
 * DB 삽입은 service_role 로 수행하므로 RLS 우회가 허용된다.
 *
 * 중복 방지:
 *  - actorId === recipientId 인 경우 자기 자신에게는 보내지 않는다.
 *  - 30초 이내 동일 (actorId, notificationType, entityId) 조합의 알림이
 *    이미 존재하면 건너뛴다 (debounce 기반 실시간 수정 중복 방지).
 */
export async function POST(request: Request) {
    // 1. 인증 확인
    const serverSupabase = await createServerSupabase()
    const { data: { user } } = await serverSupabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. 요청 파싱
    let payload: TriggerNotificationPayload
    try {
        payload = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const {
        recipientIds,
        actorId,
        notificationType,
        entityType,
        entityId,
        calendarId,
        metadata,
    } = payload

    if (!recipientIds?.length || !notificationType || !entityType || !entityId) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // 3. service_role 클라이언트 (RLS 우회)
    const serviceSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 4. 중복 방지 체크 (30초 debounce window)
    const dedupeWindow = new Date(Date.now() - 30_000).toISOString()
    const digestKey = `${notificationType}:${entityType}:${entityId}`

    const { data: recentNotif } = await serviceSupabase
        .from("notifications")
        .select("id")
        .eq("actor_id", actorId ?? user.id)
        .eq("digest_key", digestKey)
        .gte("created_at", dedupeWindow)
        .limit(1)
        .maybeSingle()

    if (recentNotif) {
        // 30초 이내 동일 알림 존재 → 건너뜀
        return NextResponse.json({ skipped: true })
    }

    // 5. 각 수신자에게 알림 생성 (자기 자신 제외)
    const targets = recipientIds.filter((id) => id !== (actorId ?? user.id))
    if (targets.length === 0) {
        return NextResponse.json({ skipped: true })
    }

    const results = await Promise.allSettled(
        targets.map((recipientId) =>
            serviceSupabase.rpc("create_notification", {
                p_recipient_id: recipientId,
                p_actor_id: actorId ?? null,
                p_notification_type: notificationType,
                p_entity_type: entityType,
                p_entity_id: entityId,
                p_calendar_id: calendarId ?? null,
                p_metadata: metadata ?? {},
            })
        )
    )

    const errors = results
        .filter((r) => r.status === "rejected")
        .map((r) => (r as PromiseRejectedResult).reason)

    if (errors.length > 0) {
        console.error("[notification/trigger] partial failure", errors)
    }

    return NextResponse.json({ sent: targets.length - errors.length })
}
