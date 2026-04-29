import { getServerUser } from "@/lib/auth/get-server-user"
import { resolveServerCalendarPath } from "@/lib/calendar/resolve-server-calendar-path"
import { createServerSupabase } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export default async function Home() {
    const [cookieStore, user, supabase] = await Promise.all([
        cookies(),
        getServerUser(),
        createServerSupabase(),
    ])

    if (!user) {
        redirect("/calendar/demo")
    }

    redirect(
        await resolveServerCalendarPath({
            supabase,
            userId: user.id,
            cookieStore,
            fallbackPath: "/calendar/demo",
        })
    )
}
