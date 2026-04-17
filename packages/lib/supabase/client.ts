import { createBrowserClient } from "@supabase/ssr"

let client: ReturnType<typeof createBrowserClient> | null = null

export function createBrowserSupabase() {
    if (client) return client

    client = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            auth: {
                flowType: "pkce",
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
            },

            realtime: {
                params: {
                    transport: "websocket",
                    log_level: "info",
                },
            },
        }
    )

    return client
}
