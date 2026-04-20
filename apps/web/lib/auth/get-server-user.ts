import { createServerSupabase } from "@/lib/supabase/server"
import type { User } from "@supabase/supabase-js"
import { cache } from "react"

export const getServerUser = cache(async (): Promise<User | null> => {
    const supabase = await createServerSupabase()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    return user
})
