import { NextResponse } from "next/server"
import { processPendingNotificationDeliveries } from "@/lib/notification/delivery"
import { createServerSupabase } from "@/lib/supabase/server"

export async function POST() {
    const serverSupabase = await createServerSupabase()
    const {
        data: { user },
    } = await serverSupabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const result = await processPendingNotificationDeliveries(25)
        return NextResponse.json(result)
    } catch (error) {
        console.error("[notification/process-pending] failed", error)
        return NextResponse.json(
            { error: "Failed to process pending notifications" },
            { status: 500 }
        )
    }
}
