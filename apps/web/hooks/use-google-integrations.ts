"use client"

/**
 * 현재 유저가 연결한 Google 계정 목록을 조회하는 훅
 * user_google_integrations 테이블에서 읽음
 */

import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { useCalendarStore } from "@/store/useCalendarStore"
import { useEffect, useState } from "react"

export type GoogleIntegration = {
    googleAccountId: string
    googleEmail: string
    googleDisplayName: string | null
}

export function useGoogleIntegrations() {
    const activeCalendarId = useCalendarStore((s) => s.activeCalendar?.id)
    const [integrations, setIntegrations] = useState<GoogleIntegration[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const reload = async () => {
        if (!activeCalendarId || activeCalendarId === "demo") {
            setIntegrations([])
            return
        }

        setIsLoading(true)
        const supabase = createBrowserSupabase()
        const { data } = await supabase
            .from("user_google_integrations")
            .select("google_account_id, google_email, google_display_name")
            .order("created_at", { ascending: true })

        setIsLoading(false)
        setIntegrations(
            (data ?? []).map((r: { google_account_id: string; google_email: string; google_display_name: string | null }) => ({
                googleAccountId: r.google_account_id,
                googleEmail: r.google_email,
                googleDisplayName: r.google_display_name,
            }))
        )
    }

    useEffect(() => {
        void reload()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCalendarId])

    return { integrations, isLoading, reload }
}
