import { createClient } from "@supabase/supabase-js"

function createNotificationServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function stringifyError(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }
    if (typeof error === "string") {
        return error
    }
    try {
        return JSON.stringify(error)
    } catch {
        return "Unknown error"
    }
}

export async function processPendingNotificationDeliveries(
    limit = 20
): Promise<{ dispatched: number }> {
    const serviceSupabase = createNotificationServiceClient()

    const { data, error } = await serviceSupabase.rpc(
        "dispatch_pending_notification_delivery_jobs" as never,
        {
            p_limit: limit,
        } as never
    )

    if (error) {
        throw error
    }

    const dispatched = Number(data ?? 0)
    if (Number.isNaN(dispatched)) {
        console.error(
            "[notification] unexpected dispatch count",
            stringifyError(data)
        )
        return { dispatched: 0 }
    }

    return { dispatched }
}
