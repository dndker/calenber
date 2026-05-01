"use client"

import { useEffect, useRef } from "react"
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { createBrowserSupabase as createClient } from "@/lib/supabase/client"
import { useAuthStore } from "@/store/useAuthStore"
import { useNotificationStore } from "@/store/useNotificationStore"
import {
    getNotificationRealtimeTopic,
    mapRealtimeDigestRow,
    type NotificationDigestRealtimeRow,
} from "@/lib/notification/realtime"

/**
 * 로그인한 유저의 notification_digests 테이블 변경을 Supabase Realtime 으로 구독한다.
 * 새 알림이 생기면 스토어의 upsertDigest 를 호출해 목록을 즉시 갱신한다.
 *
 * 주의: 이 훅은 앱 최상위(레이아웃)에서 단 한 번 마운트되어야 한다.
 */
export function useNotificationRealtime() {
    const user = useAuthStore((s) => s.user)
    const upsertDigest = useNotificationStore((s) => s.upsertDigest)
    const syncUnreadCount = useNotificationStore((s) => s.syncUnreadCount)

    const channelRef = useRef<RealtimeChannel | null>(null)

    useEffect(() => {
        if (!user) return

        const supabase = createClient()
        const topic = getNotificationRealtimeTopic(user.id)

        const channel = supabase
            .channel(topic)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "notification_digests",
                    filter: `recipient_id=eq.${user.id}`,
                },
                async (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
                    const row = (payload.new ?? payload.old) as NotificationDigestRealtimeRow
                    if (
                        !row?.latest_notification_id ||
                        !row.notification_type ||
                        !row.entity_type ||
                        !row.entity_id
                    ) {
                        await syncUnreadCount()
                        return
                    }

                    const digest = mapRealtimeDigestRow(row)
                    upsertDigest(digest)
                }
            )
            .subscribe()

        channelRef.current = channel

        return () => {
            supabase.removeChannel(channel)
            channelRef.current = null
        }
    }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
}
