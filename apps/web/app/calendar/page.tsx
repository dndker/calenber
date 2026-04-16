import { getLatestCalendarIdForUser } from "@/lib/calendar/queries"
import { getCalendarPath } from "@/lib/calendar/routes"
import { createServerSupabase } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function Page() {
    const supabase = await createServerSupabase()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/calendar/demo")
    }

    const calendarId = await getLatestCalendarIdForUser(supabase, user.id)

    redirect(calendarId ? getCalendarPath(calendarId) : "/calendar/demo")
}
