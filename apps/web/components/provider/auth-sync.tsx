"use client"

import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { mapUser } from "@workspace/lib/supabase/map-user"
import type { AuthChangeEvent, Session } from "@supabase/supabase-js"
import { useEffect } from "react"
import { useAuthStore } from "@/store/useAuthStore"

export function AuthSync() {
    const setUser = useAuthStore((s) => s.setUser)
    const setLoading = useAuthStore((s) => s.setLoading)

    useEffect(() => {
        const supabase = createBrowserSupabase()

        const syncUser = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession()

            setUser(mapUser(session?.user ?? null))
            setLoading(false)
        }

        void syncUser()

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(
            (_event: AuthChangeEvent, session: Session | null) => {
                setUser(mapUser(session?.user ?? null))
                setLoading(false)
            }
        )

        return () => {
            subscription.unsubscribe()
        }
    }, [setLoading, setUser])

    return null
}
