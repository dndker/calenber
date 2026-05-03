/**
 * DELETE /api/google-calendar/integration
 * 연결된 Google 계정을 해제하고 관련 구독/채널을 정리한다.
 */

import { getServerUser } from "@/lib/auth/get-server-user"
import { stopGoogleCalendarWatch } from "@/lib/google/calendar-api"
import { createServerSupabase } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

type DisconnectBody = {
    accountId?: string
}

export async function DELETE(request: Request) {
    const user = await getServerUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as DisconnectBody | null
    const accountId = body?.accountId?.trim()

    if (!accountId) {
        return NextResponse.json({ error: "accountId required" }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    const { data: integration } = await supabase
        .from("user_google_integrations")
        .select("access_token")
        .eq("user_id", user.id)
        .eq("google_account_id", accountId)
        .maybeSingle()

    if (!integration) {
        return NextResponse.json({ success: true })
    }

    const accessToken = integration.access_token as string | null

    const { data: catalogs } = await supabase
        .from("calendar_subscription_catalogs")
        .select("id")
        .eq("source_type", "google_calendar")
        .eq("owner_user_id", user.id)
        .contains("config", { googleAccountId: accountId })

    const catalogIds = (catalogs ?? []).map((catalog) => catalog.id as string)

    if (catalogIds.length > 0) {
        const { data: channels } = await supabase
            .from("google_calendar_sync_channels")
            .select("channel_id, resource_id")
            .eq("owner_user_id", user.id)
            .in("subscription_catalog_id", catalogIds)

        if (accessToken && channels && channels.length > 0) {
            for (const channel of channels) {
                try {
                    await stopGoogleCalendarWatch(
                        accessToken,
                        channel.channel_id as string,
                        channel.resource_id as string
                    )
                } catch (error) {
                    console.warn("Failed to stop Google watch channel:", error)
                }
            }
        }

        await supabase
            .from("calendar_subscription_catalogs")
            .delete()
            .eq("owner_user_id", user.id)
            .in("id", catalogIds)
    }

    await supabase
        .from("user_google_integrations")
        .delete()
        .eq("user_id", user.id)
        .eq("google_account_id", accountId)

    return NextResponse.json({ success: true })
}
