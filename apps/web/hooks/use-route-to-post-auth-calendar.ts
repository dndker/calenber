"use client"

import { resolvePostAuthCalendarPath } from "@/lib/calendar/resolve-post-auth-calendar-path"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { mapUser } from "@workspace/lib/supabase/map-user"
import type { User } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/useAuthStore"

function sleep(ms: number) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms)
    })
}

export function useRouteToPostAuthCalendar() {
    const router = useRouter()
    const setUser = useAuthStore((state) => state.setUser)
    const setLoading = useAuthStore((state) => state.setLoading)

    return async (user?: User | null) => {
        try {
            if (user) {
                setUser(mapUser(user))
                setLoading(false)
                router.replace(await resolvePostAuthCalendarPath(user.id))
                return
            }

            const supabase = createBrowserSupabase()

            for (let attempt = 0; attempt < 3; attempt += 1) {
                const {
                    data: { session },
                } = await supabase.auth.getSession()

                if (session?.user) {
                    setUser(mapUser(session.user))
                    setLoading(false)
                    router.replace(
                        await resolvePostAuthCalendarPath(session.user.id)
                    )
                    return
                }

                await sleep(50 * (attempt + 1))
            }

            setLoading(false)
            router.replace("/calendar")
        } catch (error) {
            console.error("Failed to route to post-auth calendar:", error)
            setLoading(false)
            router.replace("/calendar")
        }
    }
}
