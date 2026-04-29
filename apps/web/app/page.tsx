import { getServerUser } from "@/lib/auth/get-server-user"
import { getLatestCalendarIdForUser } from "@/lib/calendar/queries"
import { getCalendarPath } from "@/lib/calendar/routes"
import { createServerSupabase } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function Home() {
    const user = await getServerUser()

    if (!user) {
        redirect("/calendar/demo")
    }

    const supabase = await createServerSupabase()
    const calendarId = await getLatestCalendarIdForUser(supabase, user.id)

    redirect(calendarId ? getCalendarPath(calendarId) : "/calendar/demo")
}
